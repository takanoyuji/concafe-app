#!/usr/bin/env bash
#
# Airレジ 取引情報取得API から生JSONを日次で取得して保存する。
#
# なぜ「取ってから考える」のか:
#   Airレジ API は businessDate を 62日 までしか遡れない（IF定義書_01 取引情報取得 p.1）。
#   取り損ねた日は、あとから明細レベルでは二度と取得できない。
#   商品別売上CSVは後日でも落とせるが、あれは集計済みで、取引明細・支払方法・原価を持たない。
#   したがって、集計方法やDB設計が固まるのを待たずに、まず生JSONを確保する。
#   集計は保存したJSONから何度でもやり直せる。
#
# 保存先: $AIRREGI_RAW_DIR/<store>/<businessDate>.json.gz
#
# 使い方:
#   ./airregi-fetch.sh                        # 直近61営業日ぶん（初回バックフィル）
#   ./airregi-fetch.sh --days 45              # 直近45日ぶん（日次cron用）
#   ./airregi-fetch.sh --from 20260701 --to 20260715
#   ./airregi-fetch.sh --store tokyo          # 店舗を絞る
#   ./airregi-fetch.sh --skip-existing        # 既にファイルがある日は飛ばす（中断からの再開用）
#   ./airregi-fetch.sh --dry-run              # 疎通と認証だけ確認する（ファイルを書かない）
#
# 既定では毎回上書きする。会計金額修正・伝票削除は後日発生するため、
# 同じ営業日を取り直した結果のほうが新しい（補足資料 3.1）。
#
set -euo pipefail

# 本番は airregi.jp 固定。テスト時だけモックサーバーへ向けられるようにしてある
# （固定IP制限があり開発機からは本物を叩けないため、モックでしか動作確認できない）
readonly API_URL="${AIRREGI_API_URL:-https://airregi.jp/api/transactions}"
readonly MAX_LOOKBACK_DAYS=62   # API仕様の上限。これを超える日付はリクエストしない
readonly SLEEP_BETWEEN=1        # レートリミットに触らないためのリクエスト間隔（秒）
readonly MAX_RETRY_429=5
readonly MAX_RETRY_5XX=3

CONFIG_FILE="${AIRREGI_CONFIG:-/opt/apps/concafe-app/.airregi.env}"

# ---- 設定の読み込み -------------------------------------------------------
if [ ! -f "$CONFIG_FILE" ]; then
  echo "設定ファイルがありません: $CONFIG_FILE" >&2
  echo "scripts/airregi.env.example をコピーして、キーとトークンを記入してください。" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

RAW_DIR="${AIRREGI_RAW_DIR:-/opt/apps/concafe-app/airregi-raw}"
STORES="${AIRREGI_STORES:-tokyo osaka nagoya}"

# ---- 引数 -----------------------------------------------------------------
DAYS=61
FROM=""
TO=""
ONLY_STORE=""
SKIP_EXISTING=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --days)          DAYS="$2"; shift 2 ;;
    --from)          FROM="$2"; shift 2 ;;
    --to)            TO="$2";   shift 2 ;;
    --store)         ONLY_STORE="$2"; shift 2 ;;
    --skip-existing) SKIP_EXISTING=1; shift ;;
    --dry-run)       DRY_RUN=1; shift ;;
    -h|--help)       sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "不明な引数: $1" >&2; exit 2 ;;
  esac
done

[ -n "$ONLY_STORE" ] && STORES="$ONLY_STORE"

# ---- 対象営業日の一覧を作る -----------------------------------------------
# 当日は営業が終わっていない（かつレジ精算前）ので既定では取らない。前日まで。
build_dates() {
  local dates=()
  if [ -n "$FROM" ] && [ -n "$TO" ]; then
    local cur="$FROM"
    while [ "$cur" -le "$TO" ]; do
      dates+=("$cur")
      cur=$(date -d "$cur + 1 day" +%Y%m%d)
    done
  else
    local i
    for (( i = DAYS; i >= 1; i-- )); do
      dates+=("$(date -d "-$i day" +%Y%m%d)")
    done
  fi
  printf '%s\n' "${dates[@]}"
}

# 62日より古い日付はAPIが受け付けないので、投げる前に落とす
readonly OLDEST=$(date -d "-${MAX_LOOKBACK_DAYS} day" +%Y%m%d)

# ---- 1ページ取得。成功なら本文のパスを stdout に出す -----------------------
# $1=key $2=token $3=businessDate $4=cursor(空可) $5=出力先ファイル
fetch_page() {
  local key="$1" token="$2" bd="$3" cursor="$4" out="$5"
  local hdr; hdr="$(mktemp)"
  local attempt_429=0 attempt_5xx=0 http

  while :; do
    local args=(
      -sS -m 90
      -H "Air-Regi-Api-Key: ${key}"
      -H "Air-Regi-Api-Token: ${token}"
      -D "$hdr" -o "$out" -w '%{http_code}'
      --get
      --data-urlencode "businessDate=${bd}"
      --data-urlencode "includeOrders=1"
      --data-urlencode "includePaymentMethods=1"
    )
    [ -n "$cursor" ] && args+=( --data-urlencode "nextCursor=${cursor}" )

    http="$(curl "${args[@]}" "$API_URL" || echo "000")"

    case "$http" in
      200)
        rm -f "$hdr"
        return 0
        ;;
      429)
        # Retry-After（秒）に従う。ヘッダが無ければ漸増で待つ
        attempt_429=$(( attempt_429 + 1 ))
        if [ "$attempt_429" -gt "$MAX_RETRY_429" ]; then
          echo "    429 が $MAX_RETRY_429 回続いたため中断" >&2
          rm -f "$hdr"; return 1
        fi
        local wait
        wait="$(grep -i '^retry-after:' "$hdr" | tr -d '\r' | awk '{print $2}' | head -1)"
        [ -z "$wait" ] && wait=$(( attempt_429 * 30 ))
        echo "    429 レートリミット。${wait}秒待って再試行 (${attempt_429}/${MAX_RETRY_429})" >&2
        sleep "$wait"
        ;;
      500|502|503|504|000)
        attempt_5xx=$(( attempt_5xx + 1 ))
        if [ "$attempt_5xx" -gt "$MAX_RETRY_5XX" ]; then
          echo "    HTTP ${http} が $MAX_RETRY_5XX 回続いたため中断" >&2
          rm -f "$hdr"; return 1
        fi
        local back=$(( attempt_5xx * attempt_5xx * 5 ))
        echo "    HTTP ${http}。${back}秒待って再試行 (${attempt_5xx}/${MAX_RETRY_5XX})" >&2
        sleep "$back"
        ;;
      401|403)
        # キー/トークンの誤り、API利用設定OFF、アクセス権なし。再試行しても無駄
        echo "    HTTP ${http} 認証エラー: $(head -c 300 "$out")" >&2
        rm -f "$hdr"; return 2
        ;;
      *)
        echo "    HTTP ${http}: $(head -c 300 "$out")" >&2
        rm -f "$hdr"; return 1
        ;;
    esac
  done
}

# ---- 1営業日ぶんを取得（ページングを畳んで1ファイルにする）-----------------
# $1=store $2=key $3=token $4=businessDate
fetch_day() {
  local store="$1" key="$2" token="$3" bd="$4"
  local dest_dir="${RAW_DIR}/${store}"
  local dest="${dest_dir}/${bd}.json.gz"

  if [ "$SKIP_EXISTING" = "1" ] && [ -s "$dest" ]; then
    echo "  ${bd} スキップ（既存）"
    return 0
  fi

  local work; work="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$work'" RETURN

  local cursor="" page=0 rc
  while :; do
    page=$(( page + 1 ))
    local body="${work}/page-$(printf '%03d' "$page").json"

    # set +e / set -e のトグルは使わない。set -e はシェル全体の設定なので、
    # 関数の中で戻すと呼び出し元の +e まで解除してしまい、失敗コードで返った瞬間に
    # スクリプトごと終了する。|| で受ければ set -e は発動しない
    rc=0
    fetch_page "$key" "$token" "$bd" "$cursor" "$body" || rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "  ${bd} 失敗（ページ${page}）"
      return "$rc"
    fi

    # APIは200でもボディの code でエラーを返す（0000 が正常）
    # jq へは常に stdin で渡す。snap版 jq はファイル引数のパスを開けないことがある
    local code
    code="$(jq -r '.code // empty' < "$body" 2>/dev/null || true)"
    if [ "$code" != "0000" ]; then
      echo "  ${bd} 失敗: code=${code:-不明} message=$(jq -r '.message // ""' < "$body" 2>/dev/null)"
      return 1
    fi

    cursor="$(jq -r '.nextCursor // empty' < "$body")"
    [ -z "$cursor" ] && break

    sleep "$SLEEP_BETWEEN"
  done

  local tx_count
  tx_count="$(cat "${work}"/page-*.json | jq -s '[.[] | (.transactions // []) | length] | add // 0')"

  if [ "$DRY_RUN" = "1" ]; then
    echo "  ${bd} OK（dry-run・書き込みなし） ページ${page} 取引${tx_count}件"
    return 0
  fi

  mkdir -p "$dest_dir"
  # 中途半端なファイルを残さないよう、一時ファイルに書いてから置き換える
  local tmp="${dest}.tmp.$$"
  cat "${work}"/page-*.json | jq -s \
    --arg store "$store" \
    --arg businessDate "$bd" \
    --arg fetchedAt "$(date --iso-8601=seconds)" \
    '{store: $store,
      businessDate: $businessDate,
      fetchedAt: $fetchedAt,
      endpoint: "transactions",
      params: {includeOrders: 1, includePaymentMethods: 1},
      pageCount: length,
      transactionCount: ([.[] | (.transactions // []) | length] | add // 0),
      pages: .}' | gzip -9 > "$tmp"
  mv -f "$tmp" "$dest"

  echo "  ${bd} OK ページ${page} 取引${tx_count}件 $(du -h "$dest" | cut -f1)"
  return 0
}

# ---- 本体 -----------------------------------------------------------------
mapfile -t DATES < <(build_dates)

echo "=== Airレジ 取引情報取得 ==="
echo "対象店舗 : ${STORES}"
echo "対象期間 : ${DATES[0]} 〜 ${DATES[-1]}（${#DATES[@]}日）"
echo "保存先   : ${RAW_DIR}"
[ "$DRY_RUN" = "1" ] && echo "モード   : dry-run（書き込みなし）"
echo

total_ok=0; total_ng=0
declare -a failed=()

for store in $STORES; do
  key_var="AIRREGI_KEY_${store}"
  token_var="AIRREGI_TOKEN_${store}"
  key="${!key_var:-}"
  token="${!token_var:-}"

  if [ -z "$key" ] || [ -z "$token" ]; then
    echo "[${store}] ${key_var} / ${token_var} が未設定のため飛ばします" >&2
    continue
  fi

  echo "[${store}]"
  for bd in "${DATES[@]}"; do
    if [ "$bd" -lt "$OLDEST" ]; then
      echo "  ${bd} 飛ばす（62日の取得上限より古い）"
      continue
    fi

    rc=0
    fetch_day "$store" "$key" "$token" "$bd" || rc=$?

    if [ "$rc" -eq 0 ]; then
      total_ok=$(( total_ok + 1 ))
    else
      total_ng=$(( total_ng + 1 ))
      failed+=("${store}/${bd}")
      # 認証エラーはこの店舗では回復しないので、残りの日を試さない
      if [ "$rc" -eq 2 ]; then
        echo "  認証エラーのため [${store}] を中断します" >&2
        break
      fi
    fi
    sleep "$SLEEP_BETWEEN"
    # dry-run は疎通確認が目的なので1日で切り上げる
    [ "$DRY_RUN" = "1" ] && break
  done
  echo
done

echo "=== 結果: 成功 ${total_ok} / 失敗 ${total_ng} ==="
if [ "${#failed[@]}" -gt 0 ]; then
  echo "取得できなかった日:" >&2
  printf '  %s\n' "${failed[@]}" >&2
  echo "62日を過ぎると取り返せません。原因を潰して再実行してください。" >&2
  exit 1
fi
