import { describe, it, expect, beforeEach, afterAll } from "vitest";
import iconv from "iconv-lite";

import { prisma } from "@/lib/prisma";
import { buildSalesRows, buildSalesInput, sumOrderDiscount, assertPeriodComplete, eachDate, AirRegiPeriodError } from "@/lib/airregiSales";
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

describe("全体割引（Phase 4: 割引後を正とする）", () => {
  it("店舗の売上・粗利・貢献利益から引かれ、仕入は変わらない", async () => {
    const rows = parseSalesCsv(salesCsv([["キャスドリ", "暗本", "内税", "110000", "88000", "10"]]));
    const wage = wageCsv([["暗本太郎", "0", "0", "0:00"]]);

    const noDisc = calculateSalaryFromRows(rows, wage, CASTS);
    const withDisc = calculateSalaryFromRows(rows, wage, CASTS, [], { orderDiscount: -500 });

    expect(withDisc.orderDiscount).toBe(-500);
    // 売上（税込）は割引額そのまま
    expect(withDisc.totalSalesTaxIncl).toBe(noDisc.totalSalesTaxIncl - 500);
    // 粗利は内税の行と同じ扱いで9割ぶん（割引は税込のため）
    expect(withDisc.grossProfit).toBeCloseTo(noDisc.grossProfit - 450, 6);
    expect(withDisc.contributionProfit).toBeCloseTo(noDisc.contributionProfit - 450, 6);
    // 仕入は割引でほとんど動かない（残差は既存の「内税は×0.1」と「消費税は÷11」の差）
    expect(Math.abs(withDisc.purchases - noDisc.purchases)).toBeLessThan(10);
  });

  it("キャストのバックは変わらない（伝票単位なので按分できない）", async () => {
    const rows = parseSalesCsv(salesCsv([["キャスドリ", "暗本", "内税", "110000", "88000", "10"]]));
    const wage = wageCsv([["暗本太郎", "0", "0", "0:00"]]);

    const noDisc = calculateSalaryFromRows(rows, wage, CASTS);
    const withDisc = calculateSalaryFromRows(rows, wage, CASTS, [], { orderDiscount: -500 });

    expect(withDisc.casts[0]!.back).toBeCloseTo(noDisc.casts[0]!.back, 6);
    expect(withDisc.casts[0]!.payment).toBe(noDisc.casts[0]!.payment);
    expect(withDisc.casts[0]!.grossProfit).toBeCloseTo(noDisc.casts[0]!.grossProfit, 6);
  });

  it("遠隔の売上は動かさない（どちらの割引か決められないため）", async () => {
    const rows = parseSalesCsv(salesCsv([
      ["キャスドリ",   "暗本",      "内税", "50000", "40000", "5"],
      ["遠隔ドリンク", "遠隔_暗本", "内税", "60000", "48000", "5"],
    ]));
    const wage = wageCsv([["暗本太郎", "0", "0", "0:00"]]);
    const r = calculateSalaryFromRows(rows, wage, CASTS, [], { orderDiscount: -500 });

    expect(r.remoteSales).toBe(60000);
    expect(r.localSales).toBe(r.totalSalesTaxIncl - r.remoteSales);
    expect(r.totalSalesTaxIncl).toBe(109500);
  });

  it("指定しなければ0（CSV経路は従来どおり割引前）", () => {
    const rows = parseSalesCsv(salesCsv([["キャスドリ", "暗本", "内税", "10000", "8000", "2"]]));
    const r = calculateSalaryFromRows(rows, wageCsv([["暗本太郎", "0", "0", "0:00"]]), CASTS);
    expect(r.orderDiscount).toBe(0);
    expect(r.totalSalesTaxIncl).toBe(10000);
  });

  it("buildSalesInput は行と全体割引をまとめて返す（給与APIが呼ぶのはこちら）", async () => {
    await makeTx({
      id: "T1", businessDate: "20260801",
      orders: [{ productName: "キャスドリ", categoryName: "暗本", orderCount: 2, discountedPrice: 5000, cost: 1000 }],
    });
    await prisma.airRegiTransaction.update({
      where: { storeNo_airRegiTransactionId: { storeNo: STORE_NO, airRegiTransactionId: "T1" } },
      data: { discountAmount: -300 },
    });

    const { rows, orderDiscount } = await buildSalesInput(SLUG, "20260801", "20260801");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.販売総売上).toBe(10000);
    // 全体割引は明細に按分できないので、行には乗らず総額で返る
    expect(orderDiscount).toBe(-300);
  });

  it("sumOrderDiscount は返品を減算し、伝票削除を除外する", async () => {
    await prisma.airRegiTransaction.create({
      data: {
        storeNo: STORE_NO, storeSlug: SLUG, airRegiTransactionId: "D1", transactionType: "0",
        canceledFlg: "0", businessDate: "20260801", transactionDateTime: "2026-08-01T21:00:00+09:00",
        totalAmount: 0, discountAmount: -100, fetchedAt: new Date(),
      },
    });
    await prisma.airRegiTransaction.create({
      data: {
        storeNo: STORE_NO, storeSlug: SLUG, airRegiTransactionId: "D2", transactionType: "1",
        canceledFlg: "0", businessDate: "20260801", transactionDateTime: "2026-08-01T22:00:00+09:00",
        totalAmount: 0, discountAmount: -30, fetchedAt: new Date(),
      },
    });
    await prisma.airRegiTransaction.create({
      data: {
        storeNo: STORE_NO, storeSlug: SLUG, airRegiTransactionId: "D3", transactionType: "0",
        canceledFlg: "1", businessDate: "20260801", transactionDateTime: "2026-08-01T23:00:00+09:00",
        totalAmount: 0, discountAmount: -900, fetchedAt: new Date(),
      },
    });
    // -100 - (-30) = -70。伝票削除の -900 は入らない
    expect(await sumOrderDiscount(SLUG, "20260801", "20260801")).toBe(-70);
  });
});
