import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { calculateSalary, halfPeriodRange, type CastInput } from "@/lib/salary";
import type { RemodriCastSales } from "@/lib/remodri";

const SALES_HEADER = ["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"];
const WAGE_HEADER  = ["氏名", "基本給", "通勤手当", "労働時間"];

const csv = (header: string[], rows: string[][]) =>
  [header, ...rows].map(r => r.join(",")).join("\r\n");
const sjis = (t: string) => new Uint8Array(iconv.encode(t, "shift_jis")).buffer as ArrayBuffer;
const utf8 = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer;

// バック率0.3のキャスト1人
const CASTS: CastInput[] = [{
  castCode: "C0001", castName: "サクラ", airShiftName: "佐倉花子",
  rank: "シルバー", backRate: 0.3, exemptFromCommuteRule: false,
}];

// 店内売上のみ（内税10,000／粗利8,000 → 税調整後の粗利は 8000 - 1000 = 7000）
const salesBuf = () => sjis(csv(SALES_HEADER, [["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]));
const wageBuf  = () => utf8(csv(WAGE_HEADER,  [["佐倉花子", "9000", "500", "6:30"]]));

/** remodri は税込。粗利は profit - amount×0.1 で内税と同じ扱いにする */
const remodri = (rows: Partial<RemodriCastSales>[]): RemodriCastSales[] =>
  rows.map(r => ({
    castCode: r.castCode ?? "C0001",
    name: r.name ?? "さくら",
    amount: r.amount ?? 0,
    cost: r.cost ?? 0,
    profit: r.profit ?? (r.amount ?? 0) - (r.cost ?? 0),
  }));

describe("remodri（遠隔）の取り込み", () => {
  it("渡さなければ従来どおりの計算になる（移行前の期間の再計算）", () => {
    const before = calculateSalary(salesBuf(), wageBuf(), CASTS);
    const after  = calculateSalary(salesBuf(), wageBuf(), CASTS, []);
    expect(after).toEqual(before);
    expect(after.remodriSales).toBe(0);
    expect(after.casts[0].payment).toBe(11600); // 9000 + 500 + 7000×0.3
  });

  it("remodri の売上がキャストの粗利に乗り、バックが増える", () => {
    const r = calculateSalary(salesBuf(), wageBuf(), CASTS,
      remodri([{ amount: 50000, cost: 10000 }]));   // profit 40000
    const c = r.casts[0];
    // 遠隔の粗利 = 40000 - 50000×0.1 = 35000
    expect(c.remoteSales).toBe(50000);
    expect(c.remoteGrossProfit).toBe(35000);
    // 粗利 = 店内7000 + 遠隔35000 = 42000 → バック 12600
    expect(Math.round(c.grossProfit)).toBe(42000);
    expect(Math.round(c.back)).toBe(12600);
    expect(c.payment).toBe(Math.round((9000 + 500 + 12600) / 100) * 100);
  });

  it("業績の売上・遠隔・売上総利益に反映される", () => {
    const r = calculateSalary(salesBuf(), wageBuf(), CASTS,
      remodri([{ amount: 50000, cost: 10000 }]));
    expect(r.totalSalesTaxIncl).toBe(60000);      // 店内10,000 + 遠隔50,000
    expect(r.remoteSales).toBe(50000);
    expect(r.airRegiRemoteSales).toBe(0);         // エアレジ側に遠隔_は無い
    expect(r.remodriSales).toBe(50000);
    expect(r.localSales).toBe(10000);
    expect(Math.round(r.grossProfit)).toBe(42000);
  });

  it("エアレジの遠隔_と remodri が両方あると、内訳で分かれて二重計上に気づける", () => {
    const withAirRegiRemote = sjis(csv(SALES_HEADER, [
      ["ドリンク", "サクラ", "内税", "10000", "8000", "10"],
      ["遠隔ドリンク", "遠隔_サクラ", "内税", "30000", "24000", "5"],
    ]));
    const r = calculateSalary(withAirRegiRemote, wageBuf(), CASTS,
      remodri([{ amount: 50000, cost: 10000 }]));
    expect(r.airRegiRemoteSales).toBe(30000);
    expect(r.remodriSales).toBe(50000);
    expect(r.remoteSales).toBe(80000);   // 画面はこの内訳を見て警告を出す
  });

  it("マスタに無い castCode の売上は、バックは付かないが業績には入り、警告に出る", () => {
    const r = calculateSalary(salesBuf(), wageBuf(), CASTS,
      remodri([{ castCode: "C9999", name: "しらない子", amount: 20000, cost: 4000 }]));
    expect(r.casts[0].remoteSales).toBe(0);            // 既存キャストには付かない
    expect(r.totalSalesTaxIncl).toBe(30000);           // 店の売上には入る
    expect(r.unmatchedRemodriCasts).toEqual([
      { castCode: "C9999", name: "しらない子", amount: 20000 },
    ]);
  });

  it("赤伝（マイナス）を含んでも相殺されて正しく減る", () => {
    const r = calculateSalary(salesBuf(), wageBuf(), CASTS,
      remodri([{ amount: 50000 - 10000, cost: 10000 - 2000 }])); // remodri側で相殺済みの合計が来る
    expect(r.remodriSales).toBe(40000);
    expect(r.casts[0].remoteSales).toBe(40000);
  });
});

describe("給与期間の日付範囲", () => {
  it("前半は1日〜15日", () => {
    expect(halfPeriodRange(2026, 8, 1)).toEqual({ from: "2026-08-01", to: "2026-08-15" });
  });
  it("後半は16日〜月末", () => {
    expect(halfPeriodRange(2026, 8, 2)).toEqual({ from: "2026-08-16", to: "2026-08-31" });
    expect(halfPeriodRange(2026, 2, 2)).toEqual({ from: "2026-02-16", to: "2026-02-28" });
    expect(halfPeriodRange(2024, 2, 2)).toEqual({ from: "2024-02-16", to: "2024-02-29" }); // 閏年
  });
  it("0は月全体", () => {
    expect(halfPeriodRange(2026, 9, 0)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });
});
