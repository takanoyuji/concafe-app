import { prisma } from "@/lib/prisma";
import { orderGrossProfit, orderSales, transactionSign } from "@/lib/airregi";
import type { SalesRow } from "@/lib/salary";

/**
 * 取り込み済みの取引明細から、給与計算の売上入力（SalesRow[]）を作る。
 *
 * エアレジの商品別売上CSVを置き換えるための層。計算式そのものは lib/airregi.ts にあり、
 * 実データで現行と一致することを確認済み（docs/airregi-api.md「集計の再現性を検証済み」）。
 *
 * ⚠️ 畳む粒度は CSV と同じ「商品×バリエーション×カテゴリー×税区分」にする。
 * 業績サマリの外税→税込換算は Math.round() を行ごとに掛けるので、
 * カテゴリー単位まで畳むと丸めの位置が変わり、数円ずれることがある。
 */

/** 期間に取り込み漏れがあることを呼び出し元に伝える。欠けたまま給与を確定させない */
export class AirRegiPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirRegiPeriodError";
  }
}

/**
 * 期間内の営業日がすべて取り込めているかを確認する。
 *
 * 1日でも欠けていると、その日の売上が丸ごと抜けた給与がそれらしく出てしまう。
 * 「取引0件の日」は台帳に ok として載るので、ここでは欠けにならない。
 */
export async function assertPeriodComplete(storeSlug: string, from: string, to: string): Promise<void> {
  const logs = await prisma.airRegiSyncLog.findMany({
    where: { storeSlug, businessDate: { gte: from, lte: to } },
    select: { businessDate: true, status: true, message: true },
  });
  const okDays = new Set(logs.filter(l => l.status === "ok").map(l => l.businessDate));

  const missing: string[] = [];
  for (const d of eachDate(from, to)) {
    if (!okDays.has(d)) missing.push(d);
  }
  if (missing.length > 0) {
    const head = missing.slice(0, 10).join("、");
    throw new AirRegiPeriodError(
      `${storeSlug} の ${from}〜${to} で、取り込めていない営業日が ${missing.length} 日あります: ` +
      `${head}${missing.length > 10 ? " ほか" : ""}。` +
      `管理画面の「Airレジ 取り込み状況」から取り込み直してください`
    );
  }
}

/** YYYYMMDD の from〜to を1日ずつ返す */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(
    Number(from.slice(0, 4)), Number(from.slice(4, 6)) - 1, Number(from.slice(6, 8))
  );
  const end = new Date(
    Number(to.slice(0, 4)), Number(to.slice(4, 6)) - 1, Number(to.slice(6, 8))
  );
  while (d <= end) {
    out.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * 取引明細から SalesRow[] を作る。
 *
 * 返品（transactionType="1"）は減算、伝票削除（canceledFlg="1"）は除外する。
 * 返品も totalAmount / 明細がプラス値で返るため、符号を掛けないと二重に膨らむ。
 */
export async function buildSalesRows(storeSlug: string, from: string, to: string): Promise<SalesRow[]> {
  const txs = await prisma.airRegiTransaction.findMany({
    where: { storeSlug, businessDate: { gte: from, lte: to } },
    include: { orders: true },
  });

  // CSV と同じ粒度に畳む
  const acc = new Map<string, SalesRow>();
  for (const t of txs) {
    const sign = transactionSign(t);
    if (sign === 0) continue;

    for (const o of t.orders) {
      const rawCat = o.categoryName;
      const isRemote = rawCat.startsWith("遠隔_");
      const 税区分 = o.taxType === "1" ? "外税" : "内税";
      const 商品名 = [o.productName, o.variationName1, o.variationName2].filter(Boolean).join(" ");
      // 区切りに NUL を使う。商品名やカテゴリー名に空白が入ってもキーが衝突しないようにするため
      const key = `${商品名}\u0000${rawCat}\u0000${税区分}`;

      let row = acc.get(key);
      if (!row) {
        row = {
          商品名,
          カテゴリー: rawCat.replace(/^遠隔_/, ""),
          isRemote,
          税区分,
          販売総売上: 0,
          粗利総額: 0,
          販売商品数: 0,
        };
        acc.set(key, row);
      }
      row.販売総売上 += sign * orderSales(o);
      row.粗利総額   += sign * orderGrossProfit(o);
      row.販売商品数 += sign * o.orderCount;
    }
  }

  // 販売総売上は CSV 側も整数なので、畳み終えてから丸める
  return [...acc.values()].map(r => ({ ...r, 販売総売上: Math.round(r.販売総売上) }));
}

/**
 * 給与計算に渡す売上入力ひとまとめ。
 *
 * 全体割引は伝票単位で商品明細に按分できないため、行とは別に総額で返す。
 * 呼び出し元が calculateSalaryFromRows() の opts.orderDiscount に渡す。
 */
export async function buildSalesInput(
  storeSlug: string,
  from: string,
  to: string
): Promise<{ rows: SalesRow[]; orderDiscount: number }> {
  const [rows, orderDiscount] = await Promise.all([
    buildSalesRows(storeSlug, from, to),
    sumOrderDiscount(storeSlug, from, to),
  ]);
  return { rows, orderDiscount };
}

/** 期間内の全体割引の合計（割引はマイナス値）。返品は減算、伝票削除は除外する */
export async function sumOrderDiscount(storeSlug: string, from: string, to: string): Promise<number> {
  const txs = await prisma.airRegiTransaction.findMany({
    where: { storeSlug, businessDate: { gte: from, lte: to } },
    select: { transactionType: true, canceledFlg: true, discountAmount: true },
  });
  return txs.reduce((a, t) => a + transactionSign(t) * t.discountAmount, 0);
}
