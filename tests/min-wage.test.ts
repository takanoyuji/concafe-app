import { describe, it, expect } from "vitest";
import { checkMinimumWage, minimumWageFor } from "@/lib/minWage";
import { calculateSalary, sumHm, type CastInput } from "@/lib/salary";
import iconv from "iconv-lite";

describe("最低賃金の表", () => {
  it("年月で発効中の額を引く。月内に改定をまたぐ月は高いほう", () => {
    expect(minimumWageFor("tokyo", 2025, 9)).toMatchObject({ pref: "東京", amount: 1163 });
    expect(minimumWageFor("tokyo", 2025, 10)).toMatchObject({ amount: 1226 }); // 10/3 発効
    expect(minimumWageFor("osaka", 2026, 9)).toMatchObject({ pref: "大阪", amount: 1177 });
    expect(minimumWageFor("nagoya", 2026, 9)).toMatchObject({ pref: "愛知", amount: 1140 });
  });
});

describe("最低賃金の月間判定", () => {
  const row = (castName: string, salary: number, commute: number, workMinutes: number) => ({ castName, salary, commute, workMinutes });

  it("通勤手当を除いた給与÷労働時間が最低賃金を下回る人だけ返す", () => {
    const r = checkMinimumWage("tokyo", 2026, 9, 0, [
      row("A", 1100 * 10, 0, 600),          // 1,100円/時 → 警告
      row("B", 1100 * 10 + 5000, 0, 600),   // バック込み 1,600円/時 → OK
      row("C", 1226 * 10 + 2000, 2000, 600), // 通勤手当を除くとちょうど 1,226 → OK
      row("D", 0, 0, 0),                    // 労働時間なし → 判定しない
    ], null);
    expect(r.status).toBe("checked");
    expect(r.amount).toBe(1226);
    expect(r.warnings).toEqual([{ castName: "A", workMinutes: 600, wage: 11000, hourly: 1100 }]);
  });

  it("前半だけで後半が無ければ判定しない（半月だと誤警報になる）", () => {
    const r = checkMinimumWage("tokyo", 2026, 9, 1, [row("A", 1000, 0, 600)], null);
    expect(r.status).toBe("pending");
    expect(r.warnings).toEqual([]);
    expect(r.basis).toMatch(/後半が未保存/);
  });

  it("前半＋後半を足して月間で判定する。前半だけなら下回る人が、後半のバックで届けば出さない", () => {
    const first = [row("A", 1100 * 10, 0, 600)];           // 前半 1,100円/時
    const second = [row("A", 1100 * 10 + 4000, 0, 600)];   // 後半 バック4,000
    const r = checkMinimumWage("tokyo", 2026, 9, 2, second, first);
    expect(r.status).toBe("checked");
    // 月間 26,000円 / 20時間 = 1,300円/時 → OK
    expect(r.warnings).toEqual([]);
    expect(r.basis).toMatch(/前半＋後半/);
  });

  it("月間で足しても届かなければ出す", () => {
    const r = checkMinimumWage("nagoya", 2026, 9, 2, [row("A", 1100 * 10, 0, 600)], [row("A", 1100 * 10, 0, 600)]);
    expect(r.warnings).toEqual([{ castName: "A", workMinutes: 1200, wage: 22000, hourly: 1100 }]);
  });
});

describe("結果行に労働時間（分）が載る", () => {
  it("人件費CSVの労働時間を足したものが workMinutes になる", () => {
    const csv = (h: string[], rows: string[][]) => [h, ...rows].map(r => r.join(",")).join("\r\n");
    const sales = new Uint8Array(iconv.encode(csv(["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"], [["D", "サクラ", "内税", "1000", "800", "1"]]), "shift_jis")).buffer as ArrayBuffer;
    const wage = new TextEncoder().encode(csv(["氏名", "基本給", "通勤手当", "労働時間"], [["佐倉花子", "6000", "0", "3:30"], ["佐倉花子", "2000", "0", "1:15"]])).buffer as ArrayBuffer;
    const casts: CastInput[] = [{ castCode: "C1", castName: "サクラ", airShiftName: "佐倉花子", rank: "シルバー", backRate: 0.3, exemptFromCommuteRule: false }];
    const r = calculateSalary(sales, wage, casts);
    expect(r.casts[0].workMinutes).toBe(285);
    expect(sumHm(["1:05", "x", "0:70"])).toBe(65 + 70);
  });
});
