import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { castRewardsByMonth, castMonthlySales, storeDailySales, clearPortalCache, recentMonths, monthRange } from "@/lib/castPortal";

/**
 * キャストポータルの集計（docs/cast-portal-requirements.md）。
 * 外部API（remodri / みせ勤）は設定が無いので使われず、Airレジ取込と保存済み給与だけで動く経路を確認する。
 */
const Y = 2025, M = 3; // 直近3ヶ月の外 → ライブ計算は走らず「データなし」になる

async function reset() {
  await prisma.salaryPeriodLog.deleteMany();
  await prisma.salaryPeriod.deleteMany();
  await prisma.airRegiSyncLog.deleteMany();
  await prisma.airRegiTransaction.deleteMany();
  await prisma.castStore.deleteMany();
  await prisma.cast.deleteMany();
  clearPortalCache();
}

async function makeCast(code: string, name: string, tokyoAirRegi: string) {
  return prisma.cast.create({ data: { castCode: code, name, tokyoAirRegi, isPublished: true } });
}

async function tx(storeSlug: string, businessDate: string, totalAmount: number, opts: { category?: string; cancel?: boolean; refund?: boolean } = {}) {
  return prisma.airRegiTransaction.create({
    data: {
      storeNo: "0001", storeSlug, airRegiTransactionId: `${storeSlug}-${businessDate}-${Math.random()}`,
      transactionType: opts.refund ? "1" : "0", canceledFlg: opts.cancel ? "1" : "0",
      businessDate, transactionDateTime: `${businessDate}120000`, totalAmount, taxAmount: 0, discountAmount: 0,
      fetchedAt: new Date(),
      orders: {
        create: [{
          productName: "ドリンク", variationName1: "", variationName2: "", categoryName: opts.category ?? "サクラ",
          taxType: "0", orderCount: 1, discountedPrice: totalAmount, discountTotal: 0, cost: 0,
        }],
      },
    },
  });
}

beforeEach(reset);
afterAll(async () => { await reset(); await prisma.$disconnect(); });

describe("報酬（本人向け）", () => {
  it("確定済みの保存レコードから 合計・売上連動報酬・稼働報酬 を組み、時給や労働時間は含めない", async () => {
    const cast = await makeCast("C0001", "サクラ", "サクラ");
    await prisma.salaryPeriod.create({
      data: {
        storeName: "東京", year: Y, month: M, half: 1, finalizedAt: new Date(), finalizedByUserId: "u1",
        castRecords: { create: [{ castCode: "C0001", castName: "サクラ", hpName: "サクラ", rank: "シルバー", basicPay: 9000, commute: 500, back: 3000, salary: 12500, payment: 12500, workMinutes: 360 }] },
      },
    });
    await prisma.salaryPeriod.create({
      data: {
        storeName: "東京", year: Y, month: M, half: 2, finalizedAt: new Date(), finalizedByUserId: "u1",
        castRecords: { create: [{ castCode: "C0001", castName: "サクラ", hpName: "サクラ", rank: "シルバー", basicPay: 6000, commute: 0, back: 1000, salary: 7000, payment: 7000, workMinutes: 240 }] },
      },
    });
    const [m] = await castRewardsByMonth(cast, [{ year: Y, month: M }]);
    expect(m.status).toBe("final");
    expect(m.total).toBe(19500);
    expect(m.salesLinked).toBe(4000);
    expect(m.activity).toBe(15500);
    expect(m.halves.map(h => h.source)).toEqual(["final", "final"]);
    // キャスト向けの型に 時給・労働時間・基本給・通勤手当・率 が無い
    const keys = new Set([...Object.keys(m), ...Object.keys(m.halves[0])]);
    for (const k of ["basicPay", "commute", "workMinutes", "hourlyWage", "backRate", "rank"]) expect(keys.has(k)).toBe(false);
  });

  it("片方が未確定なら月は速報", async () => {
    const cast = await makeCast("C0001", "サクラ", "サクラ");
    await prisma.salaryPeriod.create({ data: { storeName: "東京", year: Y, month: M, half: 1, finalizedAt: new Date(), castRecords: { create: [{ castCode: "C0001", castName: "サクラ", hpName: "サクラ", back: 100, payment: 1000, salary: 1000 }] } } });
    await prisma.salaryPeriod.create({ data: { storeName: "東京", year: Y, month: M, half: 2, castRecords: { create: [{ castCode: "C0001", castName: "サクラ", hpName: "サクラ", back: 200, payment: 2000, salary: 2000 }] } } });
    const [m] = await castRewardsByMonth(cast, [{ year: Y, month: M }]);
    expect(m.status).toBe("provisional");
    expect(m.total).toBe(3000);
    expect(m.halves[0].source).toBe("final");
    expect(m.halves[1].source).toBe("live");
  });

  it("他人のレコードは足さない（castCode で引く。旧レコードは hpName で引く）", async () => {
    const cast = await makeCast("C0001", "サクラ", "サクラ");
    await makeCast("C0002", "ウメ", "ウメ");
    await prisma.salaryPeriod.create({
      data: {
        storeName: "東京", year: Y, month: M, half: 0, finalizedAt: new Date(),
        castRecords: { create: [
          { castCode: "", castName: "サクラ", hpName: "サクラ", back: 10, payment: 100, salary: 100 }, // 旧レコード（castCode 空）
          { castCode: "C0002", castName: "ウメ", hpName: "ウメ", back: 99, payment: 9900, salary: 9900 },
        ] },
      },
    });
    const [m] = await castRewardsByMonth(cast, [{ year: Y, month: M }]);
    expect(m.total).toBe(100);
    expect(m.salesLinked).toBe(10);
    expect(m.status).toBe("final");
    expect(m.halves[1]).toMatchObject({ source: "final", total: 0, note: "全月でまとめて集計" });
  });

  it("100円丸めの差は売上連動報酬に寄せ、稼働報酬をマイナスにしない", async () => {
    const cast = await makeCast("C0001", "サクラ", "サクラ");
    // 基本給0・バック 40,814 → 支払 40,800（丸め）
    await prisma.salaryPeriod.create({ data: { storeName: "東京", year: Y, month: M, half: 1, finalizedAt: new Date(), castRecords: { create: [{ castCode: "C0001", castName: "サクラ", hpName: "サクラ", basicPay: 0, back: 40814, salary: 40814, payment: 40800 }] } } });
    const [m] = await castRewardsByMonth(cast, [{ year: Y, month: M }]);
    expect(m.halves[0]).toMatchObject({ activity: 0, salesLinked: 40800, total: 40800 });
  });

  it("保存が無く直近3ヶ月の外なら「データなし」", async () => {
    const cast = await makeCast("C0001", "サクラ", "サクラ");
    const [m] = await castRewardsByMonth(cast, [{ year: Y, month: M }]);
    expect(m.halves.every(h => h.source === "none")).toBe(true);
    expect(m.total).toBe(0);
  });
});

describe("月別売上（全員向け）", () => {
  it("来店はカテゴリー＝店舗別エアレジ名で足し、赤伝はマイナス、取消は除く。退職者は出さない", async () => {
    await makeCast("C0001", "サクラ", "サクラ");
    await makeCast("C0002", "ウメ", "ウメ");
    await prisma.cast.create({ data: { castCode: "C0003", name: "退職", tokyoAirRegi: "退職", retired: true } });
    const { from } = monthRange(Y, M);
    const d1 = from.replace(/-/g, ""), d2 = d1.slice(0, 6) + "02";
    await tx("tokyo", d1, 3000, { category: "サクラ" });
    await tx("tokyo", d2, 1000, { category: "サクラ", refund: true });
    await tx("tokyo", d2, 5000, { category: "サクラ", cancel: true });
    await tx("tokyo", d1, 2000, { category: "ウメ" });
    await tx("tokyo", d1, 700, { category: "退職" });
    const { rows } = await castMonthlySales(Y, M);
    expect(rows.map(r => [r.name, r.local, r.remote, r.total])).toEqual([
      ["ウメ", 2000, 0, 2000],
      ["サクラ", 2000, 0, 2000],
    ]);
    // 同額は名前順。報酬や率のキーは無い
    expect(Object.keys(rows[0]).sort()).toEqual(["castCode", "local", "name", "remote", "total"]);
  });
});

describe("店舗の日次売上（管理画面）", () => {
  it("営業日ごとの伝票合計。赤伝はマイナス、取消は0。取り込み台帳に無い日は未取込", async () => {
    const { from } = monthRange(Y, M);
    const d1 = from.replace(/-/g, ""), d2 = d1.slice(0, 6) + "02";
    await tx("tokyo", d1, 3000);
    await tx("tokyo", d1, 1000, { refund: true });
    await tx("tokyo", d2, 5000, { cancel: true });
    await tx("osaka", d1, 9999); // 他店は混ぜない
    await prisma.airRegiSyncLog.create({ data: { storeSlug: "tokyo", businessDate: d1, status: "ok", fetchedAt: new Date() } });
    const { rows } = await storeDailySales("tokyo", Y, M);
    const r1 = rows.find(r => r.businessDate === from)!;
    const r2 = rows.find(r => r.businessDate === from.slice(0, 8) + "02")!;
    expect(r1).toMatchObject({ local: 2000, remote: 0, total: 2000, airRegiMissing: false });
    expect(r2).toMatchObject({ local: 0, airRegiMissing: true });
    expect(rows.length).toBe(31);
  });
});

describe("月の並び", () => {
  it("当月から新しい順に n ヶ月", () => {
    const ms = recentMonths(13);
    expect(ms.length).toBe(13);
    for (let i = 1; i < ms.length; i++) {
      const prev = ms[i - 1], cur = ms[i];
      expect(prev.year * 12 + prev.month - (cur.year * 12 + cur.month)).toBe(1);
    }
  });
});
