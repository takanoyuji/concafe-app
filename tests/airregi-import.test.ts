import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { gzipSync } from "node:zlib";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { importAirRegiRaw, findMissingDays } from "@/lib/airregiImport";
import { orderSales, orderGrossProfit, transactionSign, parseRawDay } from "@/lib/airregi";

const TOKYO_NO = "AKR6612359648";
const NAGOYA_NO = "AKR9839769627";

const dirs: string[] = [];

/** scripts/airregi-fetch.sh が書くのと同じ形の 1営業日ファイルを作る */
function writeDay(opts: {
  dir: string;
  storeSlug: string;
  businessDate: string;
  storeNo: string;
  fetchedAt?: string;
  transactions?: Record<string, unknown>[];
  pages?: Record<string, unknown>[];
}) {
  const pages =
    opts.pages ??
    [{ code: "0000", storeNo: opts.storeNo, transactions: opts.transactions ?? [] }];
  const doc = {
    store: opts.storeSlug,
    businessDate: opts.businessDate,
    fetchedAt: opts.fetchedAt ?? "2026-09-02T08:00:00+09:00",
    endpoint: "transactions",
    params: { includeOrders: 1, includePaymentMethods: 1 },
    pageCount: pages.length,
    transactionCount: pages.reduce((a, p) => a + ((p.transactions as unknown[]) ?? []).length, 0),
    pages,
  };
  const sub = path.join(opts.dir, opts.storeSlug);
  mkdirSync(sub, { recursive: true });
  writeFileSync(path.join(sub, `${opts.businessDate}.json.gz`), gzipSync(Buffer.from(JSON.stringify(doc))));
}

function newDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), "airregi-"));
  dirs.push(d);
  return d;
}

function tx(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    transactionType: "0",
    canceledFlg: "0",
    transactionId: "TX0001",
    businessDate: "20260820",
    transactionDateTime: "2026-08-20T21:00:00+09:00",
    voucherNo: "0001",
    totalAmount: 11000,
    taxAmount: 1000,
    discounts: [],
    paymentMethods: [{ paymentMethodName: "現金", paymentType: "000", amount: 11000 }],
    orders: [
      {
        productId: "0116", productName: "キャストドリンク",
        categoryId: "0116", categoryName: "暗本",
        orderCount: 2, discountedPrice: 5000, discountTotal: 0,
        taxType: "0", taxRate: "10", cost: 1000,
      },
    ],
    ...over,
  };
}

beforeEach(async () => {
  await prisma.airRegiTransaction.deleteMany();
  await prisma.airRegiSyncLog.deleteMany();
  await prisma.store.deleteMany();
  await prisma.store.create({
    data: { slug: "tokyo", name: "星狼 池袋店", address: "", mapQuery: "", airRegiStoreNo: TOKYO_NO },
  });
});

afterAll(async () => {
  await prisma.airRegiTransaction.deleteMany();
  await prisma.airRegiSyncLog.deleteMany();
  await prisma.store.deleteMany();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("集計式", () => {
  it("販売総売上は 単価×数量+個別割引", () => {
    expect(orderSales({ discountedPrice: 5000, orderCount: 2, discountTotal: 0 })).toBe(10000);
    expect(orderSales({ discountedPrice: 5000, orderCount: 2, discountTotal: -500 })).toBe(9500);
  });

  it("内税は粗利から売上の10%を引く。外税は引かない", () => {
    const base = { discountedPrice: 5000, orderCount: 2, discountTotal: 0, cost: 1000 };
    // 内税: (10000 - 2000) - 10000*0.1 = 7000
    expect(orderGrossProfit({ ...base, taxType: "0" })).toBe(7000);
    // 外税: 10000 - 2000 = 8000
    expect(orderGrossProfit({ ...base, taxType: "1" })).toBe(8000);
  });

  it("返品は -1、伝票削除は 0", () => {
    expect(transactionSign({ transactionType: "0", canceledFlg: "0" })).toBe(1);
    // 返品も totalAmount がプラスで返るので、符号で落とす必要がある
    expect(transactionSign({ transactionType: "1", canceledFlg: "0" })).toBe(-1);
    expect(transactionSign({ transactionType: "0", canceledFlg: "1" })).toBe(0);
  });
});

describe("生JSONの解釈", () => {
  it("ページをまたいだ取引をまとめ、全体割引を合計する", () => {
    const doc = {
      store: "tokyo", businessDate: "20260820", fetchedAt: "2026-09-02T08:00:00+09:00",
      pages: [
        { code: "0000", storeNo: TOKYO_NO, transactions: [tx({ transactionId: "A", discounts: [{ discountAmount: -30 }, { discountAmount: -20 }] })] },
        { code: "0000", storeNo: TOKYO_NO, transactions: [tx({ transactionId: "B" })] },
      ],
    };
    const parsed = parseRawDay(gzipSync(Buffer.from(JSON.stringify(doc))), "tokyo", "20260820");
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]!.discountAmount).toBe(-50);
    expect(parsed.storeNos).toEqual([TOKYO_NO]);
  });

  it("エラー応答が混ざっていたら例外にする（0件として取り込ませない）", () => {
    const doc = {
      store: "tokyo", businessDate: "20260820", fetchedAt: "2026-09-02T08:00:00+09:00",
      pages: [{ code: "2004", message: "APIトークンが無効です。" }],
    };
    expect(() => parseRawDay(gzipSync(Buffer.from(JSON.stringify(doc))), "tokyo", "20260820"))
      .toThrow(/2004/);
  });
});

describe("取り込み", () => {
  it("取引・明細・支払を入れ、台帳に記録する", async () => {
    const dir = newDir();
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO, transactions: [tx()] });

    const r = await importAirRegiRaw({ dir });
    expect(r.imported).toBe(1);
    expect(r.failed).toBe(0);

    const saved = await prisma.airRegiTransaction.findMany({ include: { orders: true, payments: true } });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.orders).toHaveLength(1);
    expect(saved[0]!.orders[0]!.categoryName).toBe("暗本");
    expect(saved[0]!.orders[0]!.cost).toBe(1000);
    expect(saved[0]!.payments[0]!.paymentType).toBe("000");

    const log = await prisma.airRegiSyncLog.findFirst();
    expect(log!.status).toBe("ok");
    expect(log!.transactionCount).toBe(1);
  });

  it("同じ日を2回取り込んでも件数が増えない（冪等）", async () => {
    const dir = newDir();
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO, transactions: [tx()] });

    await importAirRegiRaw({ dir });
    await importAirRegiRaw({ dir, force: true });

    expect(await prisma.airRegiTransaction.count()).toBe(1);
    expect(await prisma.airRegiOrder.count()).toBe(1);
  });

  it("金額が修正されて取り直された日は、新しい内容で置き換わる", async () => {
    const dir = newDir();
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO, transactions: [tx()] });
    await importAirRegiRaw({ dir });

    // 会計金額修正が入り、fetchedAt が新しくなった状態
    writeDay({
      dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO,
      fetchedAt: "2026-09-03T08:00:00+09:00",
      transactions: [tx({ totalAmount: 22000 })],
    });
    const r = await importAirRegiRaw({ dir });

    expect(r.imported).toBe(1);
    expect(await prisma.airRegiTransaction.count()).toBe(1);
    expect((await prisma.airRegiTransaction.findFirst())!.totalAmount).toBe(22000);
  });

  it("ファイルが更新されていなければ飛ばす", async () => {
    const dir = newDir();
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO, transactions: [tx()] });
    await importAirRegiRaw({ dir });

    const r = await importAirRegiRaw({ dir });
    expect(r.imported).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("⚠️ 別店舗の店舗番号のデータは取り込まない", async () => {
    const dir = newDir();
    // tokyo のディレクトリに、名古屋の店舗番号で取れたデータが入っている状態
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: NAGOYA_NO, transactions: [tx()] });

    const r = await importAirRegiRaw({ dir });
    expect(r.imported).toBe(0);
    expect(r.failed).toBe(1);
    expect(await prisma.airRegiTransaction.count()).toBe(0);

    const log = await prisma.airRegiSyncLog.findFirst();
    expect(log!.status).toBe("error");
    expect(log!.message).toContain(NAGOYA_NO);
  });

  it("営業日がファイル名と違う取引が混ざっていたら取り込まない", async () => {
    const dir = newDir();
    writeDay({
      dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO,
      transactions: [tx(), tx({ transactionId: "TX0002", businessDate: "20260819" })],
    });

    const r = await importAirRegiRaw({ dir });
    expect(r.failed).toBe(1);
    expect(await prisma.airRegiTransaction.count()).toBe(0);
  });

  it("店舗番号が未設定の店舗は連携対象外として飛ばす", async () => {
    await prisma.store.update({ where: { slug: "tokyo" }, data: { airRegiStoreNo: "" } });
    const dir = newDir();
    writeDay({ dir, storeSlug: "tokyo", businessDate: "20260820", storeNo: TOKYO_NO, transactions: [tx()] });

    const r = await importAirRegiRaw({ dir });
    expect(r.imported).toBe(0);
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(0);
  });
});

describe("取れていない営業日の検出", () => {
  it("台帳に無い営業日を欠けとして返す", async () => {
    const missing = await findMissingDays(3);
    // tokyo の3日ぶんが全部欠けている
    expect(missing).toHaveLength(3);
    expect(missing.every(m => m.storeSlug === "tokyo" && m.reason === "未取得")).toBe(true);
  });

  it("取り込み済みの日は欠けに含めない", async () => {
    const dir = newDir();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    writeDay({ dir, storeSlug: "tokyo", businessDate: yesterday, storeNo: TOKYO_NO, transactions: [tx({ businessDate: yesterday })] });
    await importAirRegiRaw({ dir });

    const missing = await findMissingDays(3);
    expect(missing.map(m => m.businessDate)).not.toContain(yesterday);
  });

  it("取り込みに失敗した日は理由つきで欠けに出る", async () => {
    const dir = newDir();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    writeDay({ dir, storeSlug: "tokyo", businessDate: yesterday, storeNo: NAGOYA_NO, transactions: [tx({ businessDate: yesterday })] });
    await importAirRegiRaw({ dir });

    const missing = await findMissingDays(3);
    const hit = missing.find(m => m.businessDate === yesterday);
    expect(hit!.reason).toContain("店舗番号");
  });
});
