import { describe, it, expect, beforeEach, afterAll } from "vitest";
import iconv from "iconv-lite";

import { prisma } from "@/lib/prisma";
import { buildSalesRows, assertPeriodComplete, eachDate, AirRegiPeriodError } from "@/lib/airregiSales";
import { parseSalesCsv, calculateSalaryFromRows, type CastInput } from "@/lib/salary";

const SLUG = "tokyo";
const STORE_NO = "AKR6612359648";

/** 取引を1件作る。orders は簡略指定 */
async function makeTx(opts: {
  id: string;
  businessDate: string;
  type?: string;
  canceled?: string;
  totalAmount?: number;
  orders: {
    productName: string;
    categoryName: string;
    orderCount: number;
    discountedPrice: number;
    cost: number;
    taxType?: string;
    discountTotal?: number;
    variationName1?: string;
  }[];
}) {
  await prisma.airRegiTransaction.create({
    data: {
      storeNo: STORE_NO,
      storeSlug: SLUG,
      airRegiTransactionId: opts.id,
      transactionType: opts.type ?? "0",
      canceledFlg: opts.canceled ?? "0",
      businessDate: opts.businessDate,
      transactionDateTime: `${opts.businessDate.slice(0, 4)}-${opts.businessDate.slice(4, 6)}-${opts.businessDate.slice(6, 8)}T21:00:00+09:00`,
      totalAmount: opts.totalAmount ?? 0,
      taxAmount: 0,
      discountAmount: 0,
      fetchedAt: new Date(),
      orders: {
        create: opts.orders.map(o => ({
          productName: o.productName,
          categoryName: o.categoryName,
          variationName1: o.variationName1 ?? "",
          orderCount: o.orderCount,
          discountedPrice: o.discountedPrice,
          discountTotal: o.discountTotal ?? 0,
          taxType: o.taxType ?? "0",
          cost: o.cost,
        })),
      },
    },
  });
}

/** その営業日を「取り込み済み」にする */
async function markSynced(businessDate: string, status = "ok") {
  await prisma.airRegiSyncLog.create({
    data: { storeSlug: SLUG, businessDate, status, fetchedAt: new Date() },
  });
}

const wageCsv = (rows: string[][]): ArrayBuffer => {
  const text = [["氏名", "基本給", "通勤手当", "労働時間"], ...rows].map(r => r.join(",")).join("\r\n");
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
};

const salesCsv = (rows: string[][]): ArrayBuffer => {
  const header = ["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"];
  const text = [header, ...rows].map(r => r.join(",")).join("\r\n");
  return new Uint8Array(iconv.encode(text, "shift_jis")).buffer as ArrayBuffer;
};

const CASTS: CastInput[] = [
  { castCode: "C9001", castName: "暗本", airShiftName: "暗本太郎", rank: "シルバー", backRate: 0.3, exemptFromCommuteRule: false },
];

beforeEach(async () => {
  await prisma.airRegiTransaction.deleteMany();
  await prisma.airRegiSyncLog.deleteMany();
});

afterAll(async () => {
  await prisma.airRegiTransaction.deleteMany();
  await prisma.airRegiSyncLog.deleteMany();
});

describe("eachDate", () => {
  it("月をまたいで1日ずつ返す", () => {
    expect(eachDate("20260830", "20260902")).toEqual(["20260830", "20260831", "20260901", "20260902"]);
  });
  it("同じ日なら1件", () => {
    expect(eachDate("20260901", "20260901")).toEqual(["20260901"]);
  });
});

describe("期間の取り込み漏れ", () => {
  it("全営業日が取り込めていれば通る", async () => {
    for (const d of eachDate("20260801", "20260803")) await markSynced(d);
    await expect(assertPeriodComplete(SLUG, "20260801", "20260803")).resolves.toBeUndefined();
  });

  it("1日でも欠けていれば例外にする（欠けたまま給与を確定させない）", async () => {
    await markSynced("20260801");
    await markSynced("20260803");
    await expect(assertPeriodComplete(SLUG, "20260801", "20260803"))
      .rejects.toThrow(AirRegiPeriodError);
    await expect(assertPeriodComplete(SLUG, "20260801", "20260803"))
      .rejects.toThrow(/20260802/);
  });

  it("取り込みに失敗した日も欠けとして扱う", async () => {
    await markSynced("20260801");
    await markSynced("20260802", "error");
    await markSynced("20260803");
    await expect(assertPeriodComplete(SLUG, "20260801", "20260803")).rejects.toThrow(/20260802/);
  });

  it("取引0件の日は欠けにしない（台帳に ok で載っているため）", async () => {
    for (const d of eachDate("20260801", "20260802")) await markSynced(d);
    await expect(assertPeriodComplete(SLUG, "20260801", "20260802")).resolves.toBeUndefined();
  });
});

describe("SalesRow の組み立て", () => {
  it("同じ商品×カテゴリー×税区分は1行に畳む", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [
        { productName: "キャスドリ", categoryName: "暗本", orderCount: 2, discountedPrice: 5000, cost: 1000 },
        { productName: "キャスドリ", categoryName: "暗本", orderCount: 1, discountedPrice: 5000, cost: 1000 },
      ],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.販売総売上).toBe(15000);
    expect(rows[0]!.販売商品数).toBe(3);
    // 内税: (15000 - 3000) - 15000*0.1 = 10500
    expect(rows[0]!.粗利総額).toBeCloseTo(10500, 6);
  });

  it("バリエーションが違えば別の行にする（CSVと同じ粒度）", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [
        { productName: "オリシャン", variationName1: "シルバー", categoryName: "暗本", orderCount: 1, discountedPrice: 10000, cost: 2000 },
        { productName: "オリシャン", variationName1: "ゴールド", categoryName: "暗本", orderCount: 1, discountedPrice: 30000, cost: 5000 },
      ],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows).toHaveLength(2);
  });

  it("遠隔_ は接頭辞を剥がし isRemote を立てる", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [{ productName: "遠隔ドリンク", categoryName: "遠隔_暗本", orderCount: 1, discountedPrice: 3000, cost: 500 }],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows[0]!.カテゴリー).toBe("暗本");
    expect(rows[0]!.isRemote).toBe(true);
  });

  it("外税は税区分が外税になり、粗利から10%を引かない", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [{ productName: "オリシャン", categoryName: "暗本", orderCount: 1, discountedPrice: 10000, cost: 2000, taxType: "1" }],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows[0]!.税区分).toBe("外税");
    expect(rows[0]!.粗利総額).toBe(8000);
  });

  it("⚠️ 返品は減算する（プラス値で返るので符号を掛けないと二重に増える）", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [{ productName: "キャスドリ", categoryName: "暗本", orderCount: 4, discountedPrice: 5000, cost: 1000 }],
    });
    await makeTx({
      id: "T2", businessDate: "20260801", type: "1",
      orders: [{ productName: "キャスドリ", categoryName: "暗本", orderCount: 1, discountedPrice: 5000, cost: 1000 }],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.販売総売上).toBe(15000); // 20000 - 5000
    expect(rows[0]!.販売商品数).toBe(3);
  });

  it("伝票削除は集計から外す", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801", canceled: "1",
      orders: [{ productName: "キャスドリ", categoryName: "暗本", orderCount: 2, discountedPrice: 5000, cost: 1000 }],
    });
    expect(await buildSalesRows(SLUG, "20260801", "20260801")).toHaveLength(0);
  });

  it("個別割引は明細に紐づくので単価×数量から差し引く", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [{ productName: "キャスドリ", categoryName: "暗本", orderCount: 2, discountedPrice: 5000, cost: 1000, discountTotal: -1000 }],
    });
    const rows = await buildSalesRows(SLUG, "20260801", "20260801");
    expect(rows[0]!.販売総売上).toBe(9000);
  });

  it("期間外の営業日は含めない", async () => {
    await makeTx({ id: "T1", businessDate: "20260731", orders: [{ productName: "A", categoryName: "暗本", orderCount: 1, discountedPrice: 1000, cost: 0 }] });
    await makeTx({ id: "T2", businessDate: "20260801", orders: [{ productName: "A", categoryName: "暗本", orderCount: 1, discountedPrice: 2000, cost: 0 }] });
    await makeTx({ id: "T3", businessDate: "20260816", orders: [{ productName: "A", categoryName: "暗本", orderCount: 1, discountedPrice: 4000, cost: 0 }] });
    const rows = await buildSalesRows(SLUG, "20260801", "20260815");
    expect(rows[0]!.販売総売上).toBe(2000);
  });
});

describe("CSV経路とAPI経路が同じ結果になる", () => {
  it("同じ売上を表す入力なら、給与も業績も一致する", async () => {
    // API側: 内税の明細と外税の明細を1件ずつ
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [
        { productName: "キャスドリ", categoryName: "暗本", orderCount: 2, discountedPrice: 5000, cost: 1000 },
        { productName: "オリシャン", categoryName: "暗本", orderCount: 1, discountedPrice: 20000, cost: 4000, taxType: "1" },
      ],
    });
    const apiRows = await buildSalesRows(SLUG, "20260801", "20260801");

    // CSV側: エアレジが同じ期間について書き出す商品別売上（粗利は税控除前の値）
    const csvRows = parseSalesCsv(salesCsv([
      ["キャスドリ", "暗本", "内税", "10000", "8000",  "2"],
      ["オリシャン", "暗本", "外税", "20000", "16000", "1"],
    ]));

    const wage = wageCsv([["暗本太郎", "9000", "500", "6:30"]]);
    const fromApi = calculateSalaryFromRows(apiRows, wage, CASTS);
    const fromCsv = calculateSalaryFromRows(csvRows, wage, CASTS);

    expect(fromApi.grossProfit).toBeCloseTo(fromCsv.grossProfit, 6);
    expect(fromApi.totalSalesTaxIncl).toBe(fromCsv.totalSalesTaxIncl);
    expect(fromApi.casts[0]!.payment).toBe(fromCsv.casts[0]!.payment);
    expect(fromApi.casts[0]!.back).toBeCloseTo(fromCsv.casts[0]!.back, 6);
  });
});
