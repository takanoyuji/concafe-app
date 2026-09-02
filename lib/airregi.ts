import { gunzipSync } from "node:zlib";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Airレジ API の生JSON（scripts/airregi-fetch.sh が保存したもの）を読み、
 * 集計に使う形へ正規化する。
 *
 * 生JSONは 1営業日 = 1ファイル。ページングされていた場合は pages[] に複数入っている。
 * ファイルの構造は scripts/airregi-fetch.sh 側で作っているので、両方を同時に直すこと。
 *
 * 仕様の根拠と実データでの検証結果は docs/airregi-api.md を参照。
 */

/** 生JSONが想定と違うことを呼び出し元に伝える。取り込みを続行させない */
export class AirRegiFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirRegiFormatError";
  }
}

export interface AirRegiOrderInput {
  productId: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  variationName1: string;
  variationName2: string;
  orderCount: number;
  discountedPrice: number;
  discountTotal: number;
  taxType: string;
  taxRate: string;
  cost: number;
}

export interface AirRegiPaymentInput {
  paymentMethodName: string;
  paymentType: string;
  amount: number;
}

export interface AirRegiTransactionInput {
  storeNo: string;
  storeSlug: string;
  airRegiTransactionId: string;
  transactionType: string;
  canceledFlg: string;
  businessDate: string;
  transactionDateTime: string;
  voucherNo: string;
  totalAmount: number;
  taxAmount: number;
  /** 全体割引の合計。割引はマイナス値 */
  discountAmount: number;
  orders: AirRegiOrderInput[];
  payments: AirRegiPaymentInput[];
}

export interface ParsedDay {
  storeSlug: string;
  businessDate: string;
  /** 生JSON側の取得日時 */
  fetchedAt: Date;
  /** ファイルに入っていた storeNo。呼び出し元が Store.airRegiStoreNo と照合する */
  storeNos: string[];
  transactions: AirRegiTransactionInput[];
}

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

/** <businessDate>.json.gz を1つ読んで正規化する */
export function parseRawDay(buf: Buffer, storeSlug: string, businessDate: string): ParsedDay {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(gunzipSync(buf).toString("utf-8"));
  } catch (e) {
    throw new AirRegiFormatError(
      `${storeSlug}/${businessDate} を読めませんでした: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const pages = doc.pages;
  if (!Array.isArray(pages)) {
    throw new AirRegiFormatError(`${storeSlug}/${businessDate} に pages がありません`);
  }
  // 営業日と取得日時はファイル自身の申告を信じず、呼び出し元の期待と突き合わせられるよう返す
  if (str(doc.businessDate) !== businessDate) {
    throw new AirRegiFormatError(
      `${storeSlug}/${businessDate} の中身の営業日が ${str(doc.businessDate)} です。ファイル名と一致しません`
    );
  }

  const storeNos = new Set<string>();
  const transactions: AirRegiTransactionInput[] = [];

  for (const page of pages as Record<string, unknown>[]) {
    // APIは200でも code でエラーを返す。取得スクリプト側でも弾いているが二重に見る
    const code = str(page.code);
    if (code && code !== "0000") {
      throw new AirRegiFormatError(
        `${storeSlug}/${businessDate} にエラー応答が含まれています: code=${code} ${str(page.message)}`
      );
    }
    const sn = str(page.storeNo);
    if (sn) storeNos.add(sn);

    for (const t of (page.transactions ?? []) as Record<string, unknown>[]) {
      // 全体割引は伝票単位。割引はマイナス値で入っている
      const discountAmount = ((t.discounts ?? []) as Record<string, unknown>[])
        .reduce((a, d) => a + num(d.discountAmount), 0);

      transactions.push({
        storeNo: sn,
        storeSlug,
        airRegiTransactionId: str(t.transactionId),
        transactionType: str(t.transactionType),
        canceledFlg: str(t.canceledFlg) || "0",
        businessDate: str(t.businessDate),
        transactionDateTime: str(t.transactionDateTime),
        voucherNo: str(t.voucherNo),
        totalAmount: Math.round(num(t.totalAmount)),
        taxAmount: Math.round(num(t.taxAmount)),
        discountAmount: Math.round(discountAmount),
        orders: ((t.orders ?? []) as Record<string, unknown>[]).map(o => ({
          productId: str(o.productId),
          productName: str(o.productName),
          categoryId: str(o.categoryId),
          categoryName: str(o.categoryName),
          variationName1: str(o.variationName1),
          variationName2: str(o.variationName2),
          orderCount: Math.round(num(o.orderCount)),
          discountedPrice: Math.round(num(o.discountedPrice)),
          discountTotal: Math.round(num(o.discountTotal)),
          taxType: str(o.taxType) || "0",
          taxRate: str(o.taxRate),
          cost: Math.round(num(o.cost)),
        })),
        payments: ((t.paymentMethods ?? []) as Record<string, unknown>[]).map(p => ({
          paymentMethodName: str(p.paymentMethodName),
          paymentType: str(p.paymentType),
          amount: Math.round(num(p.amount)),
        })),
      });
    }
  }

  const fetchedAt = new Date(str(doc.fetchedAt));
  if (Number.isNaN(fetchedAt.getTime())) {
    throw new AirRegiFormatError(`${storeSlug}/${businessDate} の fetchedAt を解釈できません`);
  }

  return { storeSlug, businessDate, fetchedAt, storeNos: [...storeNos], transactions };
}

/** 生JSONの置き場。コンテナには読み取り専用でマウントする */
export function rawDir(): string {
  return process.env.AIRREGI_RAW_DIR || "/airregi-raw";
}

/** 置き場にある (店舗, 営業日) の一覧。新しい営業日が先に来る */
export function listRawDays(dir = rawDir()): { storeSlug: string; businessDate: string; file: string }[] {
  if (!existsSync(dir)) return [];
  const out: { storeSlug: string; businessDate: string; file: string }[] = [];
  for (const storeSlug of readdirSync(dir)) {
    const sub = path.join(dir, storeSlug);
    let files: string[];
    try {
      files = readdirSync(sub);
    } catch {
      continue; // ディレクトリでないものが混ざっていても止めない
    }
    for (const f of files) {
      const m = /^(\d{8})\.json\.gz$/.exec(f);
      if (!m) continue;
      out.push({ storeSlug, businessDate: m[1]!, file: path.join(sub, f) });
    }
  }
  out.sort((a, b) => (a.businessDate < b.businessDate ? 1 : a.businessDate > b.businessDate ? -1 : 0));
  return out;
}

export function readRawDay(file: string, storeSlug: string, businessDate: string): ParsedDay {
  return parseRawDay(readFileSync(file), storeSlug, businessDate);
}

// ---- 集計 ----------------------------------------------------------------
//
// 現行のエアレジ売上CSV（商品別売上）と同じ数字を、取引明細から作る。
// 式は実データで検証済み（docs/airregi-api.md「集計の再現性を検証済み」）。
//
//   販売総売上 = discountedPrice × orderCount + discountTotal
//   粗利総額   = 販売総売上 − cost × orderCount
//                内税(taxType="0") なら さらに − 販売総売上 × 0.1
//   返品(transactionType="1") は全項目で減算する
//
// 粗利は明細ベースなので全体割引の影響を受けない。だから調整なしで現行と一致する。

/** 明細1行の販売総売上（個別割引の適用後） */
export function orderSales(o: Pick<AirRegiOrderInput, "discountedPrice" | "orderCount" | "discountTotal">): number {
  return o.discountedPrice * o.orderCount + o.discountTotal;
}

/** 明細1行の粗利（内税はインボイス相当の税控除まで済ませた値） */
export function orderGrossProfit(
  o: Pick<AirRegiOrderInput, "discountedPrice" | "orderCount" | "discountTotal" | "cost" | "taxType">
): number {
  const sales = orderSales(o);
  const gross = sales - o.cost * o.orderCount;
  return o.taxType === "0" ? gross - sales * 0.1 : gross;
}

/** 会計は +1、返品は -1。伝票削除は 0（集計から外す） */
export function transactionSign(t: Pick<AirRegiTransactionInput, "transactionType" | "canceledFlg">): number {
  if (t.canceledFlg === "1") return 0;
  return t.transactionType === "1" ? -1 : 1;
}
