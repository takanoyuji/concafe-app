import { describe, it, expect } from "vitest";
import { storeCoverage, hasMissingStores, halfLabel, SALARY_STORES } from "@/lib/salaryCoverage";

const p = (storeName: string, half: number) => ({ storeName, half });

describe("全店舗の網羅チェック", () => {
  it("3店舗とも前半・後半が揃っていれば欠けなし", () => {
    const c = storeCoverage(SALARY_STORES.flatMap(s => [p(s, 1), p(s, 2)]));
    expect(c.every(x => x.missingHalves.length === 0)).toBe(true);
    expect(hasMissingStores(c)).toBe(false);
  });

  it("片方の半月しか無い店舗は、欠けている側が出る", () => {
    const c = storeCoverage([p("東京", 1), p("大阪", 1), p("大阪", 2), p("名古屋", 2)]);
    expect(c.find(x => x.storeName === "東京")!.missingHalves).toEqual(["後半"]);
    expect(c.find(x => x.storeName === "大阪")!.missingHalves).toEqual([]);
    expect(c.find(x => x.storeName === "名古屋")!.missingHalves).toEqual(["前半"]);
    expect(hasMissingStores(c)).toBe(true);
  });

  it("データが1件も無い店舗は前半・後半の両方が欠けとして出る", () => {
    const c = storeCoverage([p("東京", 1), p("東京", 2)]);
    const osaka = c.find(x => x.storeName === "大阪")!;
    expect(osaka.foundHalves).toEqual([]);
    expect(osaka.missingHalves).toEqual(["前半", "後半"]);
  });

  it("half=0（全体）が1件あればその月は揃っているとみなす", () => {
    const c = storeCoverage([p("東京", 0), p("大阪", 0), p("名古屋", 0)]);
    expect(hasMissingStores(c)).toBe(false);
  });

  it("店舗は常に3件返る（データが空でも欠けを報告できる）", () => {
    const c = storeCoverage([]);
    expect(c.map(x => x.storeName)).toEqual(["東京", "大阪", "名古屋"]);
    expect(hasMissingStores(c)).toBe(true);
  });

  it("同じ半月が重複していても欠け判定は変わらない", () => {
    const c = storeCoverage([p("東京", 1), p("東京", 1), p("東京", 2)]);
    expect(c.find(x => x.storeName === "東京")!.missingHalves).toEqual([]);
  });

  it("半月のラベル", () => {
    expect([0, 1, 2].map(halfLabel)).toEqual(["全体", "前半", "後半"]);
  });
});
