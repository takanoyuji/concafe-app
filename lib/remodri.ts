/**
 * remodri（遠隔ドリンク会計）から売上を取り込む。
 *
 * 2026-08-16 に遠隔売上の記録先がエアレジから remodri へ移行した。
 * それ以降のエアレジCSVには遠隔_カテゴリーが載らないため、ここで取り込まないと
 * 業績も給与のバックも遠隔分がまるごと抜け落ちる。
 *
 * 移行前（〜2026-08-15）の期間を計算するときは remodri が0件を返すので、
 * 何も足されず従来どおりの結果になる。期間で切り替える設定は要らない。
 *
 * 金額はすべて税込（remodri 側の schema に明記）。
 * 赤伝はマイナス金額で入っており、合計するだけで相殺される。
 * 推し／もらったが別人の明細は remodri 側で50%ずつ折半済み。
 */

/** remodri が落ちている・設定が違うなど、取り込めなかったことを呼び出し元に伝える */
export class RemodriError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemodriError";
  }
}

export interface RemodriCastSales {
  castCode: string;
  name: string;
  /** 税込売上 */
  amount: number;
  /** 税込原価 */
  cost: number;
  /** amount - cost（税調整前） */
  profit: number;
}

export type RemodriStoreCode = "tokyo" | "osaka" | "nagoya";

/** 環境変数が揃っているときだけ連携する。未設定なら従来どおりエアレジのみで計算する */
export function isRemodriConfigured(): boolean {
  return Boolean(process.env.REMODRI_API_URL && process.env.REMODRI_API_KEY);
}

/**
 * 指定期間のキャスト別売上を取得する。storeCode を省くと全店舗まとめて返す。
 *
 * 遠隔はどの店舗の伝票でもキャスト本人の所属店舗に計上するため、通常は
 * 店舗で絞らずに取得し、attributeByPrimaryStore() で振り分ける。
 *
 * 取り込めなかったときは 0件を返さずに例外にする。
 * 静かに0にすると、遠隔売上が抜けたまま給与が確定してしまうため。
 */
export async function fetchRemodriSalesByCast(
  from: string,
  to: string,
  storeCode?: RemodriStoreCode
): Promise<RemodriCastSales[]> {
  const base = process.env.REMODRI_API_URL;
  const key = process.env.REMODRI_API_KEY;
  if (!base || !key) {
    throw new RemodriError("remodri の接続設定（REMODRI_API_URL / REMODRI_API_KEY）がありません");
  }

  const url =
    `${base.replace(/\/$/, "")}/api/v1/sales/summary` +
    `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=cast` +
    (storeCode ? `&storeCode=${encodeURIComponent(storeCode)}` : "");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new RemodriError(
      `remodri に接続できませんでした（${e instanceof Error ? e.message : String(e)}）`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new RemodriError(`remodri がエラーを返しました（HTTP ${res.status}）${body.slice(0, 120)}`);
  }

  const data = await res.json().catch(() => null);
  if (!data || !Array.isArray(data.rows)) {
    throw new RemodriError("remodri の応答を解釈できませんでした（rows がありません）");
  }

  return (data.rows as Record<string, unknown>[])
    .map(r => ({
      castCode: String(r.key ?? ""),
      name: String(r.label ?? ""),
      amount: Number(r.amount ?? 0),
      cost: Number(r.cost ?? 0),
      profit: Number(r.profit ?? 0),
    }))
    // キャスト未設定の明細（key が "(未設定)"）は誰のバックにもできないが、
    // 店舗の売上には含めるのでそのまま残す
    .filter(r => r.castCode !== "");
}

/**
 * 遠隔売上をキャストの所属店舗に振り分ける。
 *
 * 伝票がどの店舗で立ったかは見ない。遠隔は店舗をまたいで接客するため、
 * 売上も人件費も本人の所属店舗に計上する（2026-09-01 決定）。
 * 推し／もらったの折半は remodri 側で済んでいるので、ここでは振り分けるだけ。
 *
 * 所属店舗が分からないキャストは orphans に入れる。どの店舗にも計上されないので、
 * 呼び出し元が必ず画面に出すこと（黙って落とすと売上が消える）。
 */
export function attributeByPrimaryStore(
  rows: RemodriCastSales[],
  primaryStoreByCastCode: Map<string, string>,
  storeCode: RemodriStoreCode
): { mine: RemodriCastSales[]; orphans: RemodriCastSales[] } {
  const mine: RemodriCastSales[] = [];
  const orphans: RemodriCastSales[] = [];
  for (const row of rows) {
    const primary = primaryStoreByCastCode.get(row.castCode);
    if (!primary) orphans.push(row);
    else if (primary === storeCode) mine.push(row);
  }
  return { mine, orphans };
}
