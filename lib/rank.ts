import { prisma } from "@/lib/prisma";

/**
 * 指定年月のランクを取得する。
 * 1. CastMonthlyRank にその年月のレコードがあればそれを返す
 * 2. なければ過去の直近レコードを返す（前月引き継ぎ）
 * 3. 過去データもなければ CastMaster.rank を返す
 */
export async function getRankForPeriod(
  castMasterId: string,
  year: number,
  month: number
): Promise<string> {
  // その月のレコードを検索
  const exact = await prisma.castMonthlyRank.findUnique({
    where: { castMasterId_year_month: { castMasterId, year, month } },
  });
  if (exact) return exact.rank;

  // 過去の直近レコード
  const prev = await prisma.castMonthlyRank.findFirst({
    where: {
      castMasterId,
      OR: [
        { year: { lt: year } },
        { year, month: { lt: month } },
      ],
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  if (prev) return prev.rank;

  // フォールバック: CastMaster.rank
  const master = await prisma.castMaster.findUnique({
    where: { id: castMasterId },
    select: { rank: true },
  });
  return master?.rank ?? "";
}

/**
 * 全キャストの指定年月のランクを一括取得する。
 * キャストID → ランク の Map を返す。
 */
export async function getRanksForPeriod(
  year: number,
  month: number
): Promise<Map<string, string>> {
  const [masters, allMonthlyRanks] = await Promise.all([
    prisma.castMaster.findMany({
      where: { retired: false },
      select: { id: true, rank: true },
    }),
    prisma.castMonthlyRank.findMany({
      where: {
        OR: [
          { year, month },
          { year: { lt: year } },
          { year, month: { lt: month } },
        ],
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  const rankMap = new Map<string, string>();

  for (const master of masters) {
    // その月のレコードを検索
    const exact = allMonthlyRanks.find(
      (r) => r.castMasterId === master.id && r.year === year && r.month === month
    );
    if (exact) {
      rankMap.set(master.id, exact.rank);
      continue;
    }

    // 過去の直近レコード（既にyear desc, month descでソート済み）
    const prev = allMonthlyRanks.find((r) => r.castMasterId === master.id);
    if (prev) {
      rankMap.set(master.id, prev.rank);
      continue;
    }

    // フォールバック
    rankMap.set(master.id, master.rank);
  }

  return rankMap;
}
