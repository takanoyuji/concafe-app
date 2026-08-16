import { describe, it, expect } from "vitest";
import { orderCastsByMonthlyGift, previousMonthJst, shuffle } from "@/lib/castOrder";

type C = { id: string; name: string };
const casts: C[] = [
  { id: "a", name: "あまね" },
  { id: "b", name: "びすこ" },
  { id: "c", name: "かおる" },
  { id: "d", name: "でんき" },
  { id: "e", name: "えりか" },
];

const names = (list: C[]) => list.map(c => c.name);

describe("先月ギフト順の並び替え", () => {
  it("ギフト合計の多い順に並ぶ", () => {
    const totals = new Map([["a", 100], ["b", 500], ["c", 300]]);
    expect(names(orderCastsByMonthlyGift(casts, totals)).slice(0, 3))
      .toEqual(["びすこ", "かおる", "あまね"]);
  });

  it("ギフトが0のキャストは必ず末尾に来る", () => {
    const totals = new Map([["a", 100], ["b", 500], ["c", 300]]);
    const tail = names(orderCastsByMonthlyGift(casts, totals)).slice(3);
    expect(tail.sort()).toEqual(["えりか", "でんき"]);
  });

  it("同額のときは名前順で固定され、実行ごとに揺れない", () => {
    const totals = new Map([["a", 100], ["b", 100], ["c", 100], ["d", 100], ["e", 100]]);
    const first = names(orderCastsByMonthlyGift(casts, totals));
    for (let i = 0; i < 5; i++) {
      expect(names(orderCastsByMonthlyGift(casts, totals))).toEqual(first);
    }
    expect(first).toEqual(["あまね", "えりか", "かおる", "でんき", "びすこ"]);
  });

  it("ギフト0の並びはシャッフルされる（乱数を差し替えて確認）", () => {
    const totals = new Map([["a", 100]]);
    // random を固定すると Fisher-Yates が決まった置換になる
    const asc  = orderCastsByMonthlyGift(casts, totals, () => 0);
    const desc = orderCastsByMonthlyGift(casts, totals, () => 0.999999);
    expect(names(asc)[0]).toBe("あまね");   // 実績ありは先頭のまま
    expect(names(desc)[0]).toBe("あまね");
    expect(names(asc).slice(1)).not.toEqual(names(desc).slice(1));
    // 顔ぶれは変わらない
    expect(names(asc).slice(1).sort()).toEqual(names(desc).slice(1).sort());
  });

  it("誰も1人も欠けない・重複しない", () => {
    const totals = new Map([["a", 100], ["c", 50]]);
    const out = orderCastsByMonthlyGift(casts, totals);
    expect(out).toHaveLength(casts.length);
    expect(new Set(out.map(c => c.id)).size).toBe(casts.length);
  });

  it("全員ギフト0でも落ちない", () => {
    const out = orderCastsByMonthlyGift(casts, new Map());
    expect(out).toHaveLength(casts.length);
  });

  it("shuffle は元の配列を書き換えない", () => {
    const src = [...casts];
    shuffle(src, () => 0.5);
    expect(src).toEqual(casts);
  });
});

describe("JSTの先月", () => {
  it("月の途中は前月を返す", () => {
    expect(previousMonthJst(new Date("2026-08-17T03:00:00Z"))).toEqual({ year: 2026, month: 7 });
  });

  it("1月は前年12月になる", () => {
    expect(previousMonthJst(new Date("2026-01-05T00:00:00Z"))).toEqual({ year: 2025, month: 12 });
  });

  it("UTCではまだ前月でも、JSTで月が変わっていれば新しい月で判定する", () => {
    // UTC 2026-07-31 16:00 = JST 2026-08-01 01:00 → 先月は7月
    expect(previousMonthJst(new Date("2026-07-31T16:00:00Z"))).toEqual({ year: 2026, month: 7 });
    // UTC 2026-07-31 14:00 = JST 2026-07-31 23:00 → 先月は6月
    expect(previousMonthJst(new Date("2026-07-31T14:00:00Z"))).toEqual({ year: 2026, month: 6 });
  });
});
