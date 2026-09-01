/**
 * 全店舗の人件費を見るとき、どの店舗のデータが揃っていないかを判定する。
 *
 * 揃っていない状態で合計だけ見ると、少ない人件費を正しい数字だと思い込む。
 * 「無いものは無いと言う」ために、欠けている店舗と半月をそのまま返す。
 */

/** 給与計算で扱う店舗。給与画面の店舗プルダウンと同じ並びにする */
export const SALARY_STORES = ["東京", "大阪", "名古屋"] as const;

export const halfLabel = (half: number) => (half === 0 ? "全体" : half === 1 ? "前半" : "後半");

export interface StoreCoverage {
  storeName: string;
  /** 保存されている半月（0=全体, 1=前半, 2=後半） */
  foundHalves: number[];
  /** 欠けている半月のラベル。空なら揃っている */
  missingHalves: string[];
}

/**
 * 月内の網羅状況を店舗ごとに返す。
 * half=0（全体）が1件あればその月は揃っているとみなす。
 * そうでなければ前半・後半の両方が必要。
 */
export function storeCoverage(
  periods: { storeName: string; half: number }[],
  stores: readonly string[] = SALARY_STORES
): StoreCoverage[] {
  return stores.map(storeName => {
    const foundHalves = periods
      .filter(p => p.storeName === storeName)
      .map(p => p.half)
      .sort((a, b) => a - b);

    const missingHalves = foundHalves.includes(0)
      ? []
      : [1, 2].filter(h => !foundHalves.includes(h)).map(halfLabel);

    return { storeName, foundHalves, missingHalves };
  });
}

/** 1店舗でも欠けていれば true */
export function hasMissingStores(coverage: StoreCoverage[]): boolean {
  return coverage.some(c => c.missingHalves.length > 0);
}
