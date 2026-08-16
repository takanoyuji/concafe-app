/**
 * HP（トップページ）のキャスト表示順。
 *
 * 先月のギフト合計が多い順に並べ、ギフトが0だったキャストは末尾にまとめて
 * 毎回シャッフルする。0の人の中で固定的な有利不利が出ないようにするため。
 *
 * キャスト統合(2026-08-14)で Cast.storeId が CastStore に移り、
 * それまでの「東京→大阪→名古屋」の並び（storeId 順）が失われて
 * 実質あいうえお順になっていた。その置き換えでもある。
 */

/** JST での「先月」を返す。サーバーのタイムゾーンがUTCでも正しく求まる */
export function previousMonthJst(now: Date = new Date()): { year: number; month: number } {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = jst.getUTCMonth() + 1; // 1-12
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Fisher-Yates。引数の配列は書き換えない */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ギフト実績のあるキャストを合計の降順（同額は名前順）、
 * 実績が無いキャストを末尾にシャッフルして並べる。
 *
 * random を差し替えられるようにしてあるのはテストのため。
 */
export function orderCastsByMonthlyGift<T extends { id: string; name: string }>(
  casts: T[],
  giftTotals: Map<string, number>,
  random: () => number = Math.random
): T[] {
  const ranked: T[] = [];
  const zero: T[] = [];

  for (const cast of casts) {
    if ((giftTotals.get(cast.id) ?? 0) > 0) ranked.push(cast);
    else zero.push(cast);
  }

  ranked.sort((a, b) => {
    const diff = (giftTotals.get(b.id) ?? 0) - (giftTotals.get(a.id) ?? 0);
    // 同額のときに順番が揺れないよう名前で固定する
    return diff !== 0 ? diff : a.name.localeCompare(b.name, "ja");
  });

  return [...ranked, ...shuffle(zero, random)];
}
