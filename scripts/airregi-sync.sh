#!/usr/bin/env bash
#
# Airレジの日次同期。cron から呼ぶのはこのスクリプト。
#
#   1. airregi-fetch.sh で API から生JSONを取得する（直近45日ぶんを取り直す）
#   2. アプリの取り込みAPIを叩いて、生JSONをDBへ反映する
#
# 1 が失敗しても 2 は実行する。前日ぶんが取れなくても、それ以前の取り込み漏れは
# 進めておきたいため。終了コードは「1と2のどちらかが失敗したら 1」。
#
# 生JSONの置き場はコンテナに読み取り専用でマウントしてある（compose.yml）。
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
DAYS="${AIRREGI_SYNC_DAYS:-45}"

rc=0

echo "[$(date -Iseconds)] === Airレジ同期 開始 ==="

# ---- 1. API から取得 ----
if ! "$SCRIPT_DIR/airregi-fetch.sh" --days "$DAYS"; then
  echo "[$(date -Iseconds)] ERROR: 取得に失敗した営業日があります（62日を過ぎると取り返せません）" >&2
  rc=1
fi

# ---- 2. DB へ取り込み ----
if [ -z "${CRON_SECRET:-}" ]; then
  CRON_SECRET="$(grep '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)"
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "[$(date -Iseconds)] ERROR: CRON_SECRET が設定されていません" >&2
  exit 1
fi

APP_URL="${APP_URL:-http://localhost:3000}"
RESPONSE=$(curl -s -m 300 -w "\n%{http_code}" -X POST "$APP_URL/api/admin/airregi/import" \
  -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)
echo "[$(date -Iseconds)] 取り込み HTTP $HTTP_CODE: $BODY"

# 207 は「取り込めなかった営業日があった」。200 以外はすべて異常として扱う
if [ "$HTTP_CODE" != "200" ]; then
  echo "[$(date -Iseconds)] ERROR: 取り込みに問題があります" >&2
  rc=1
fi

echo "[$(date -Iseconds)] === Airレジ同期 終了 (rc=$rc) ==="
exit "$rc"
