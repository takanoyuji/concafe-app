import { prisma } from "@/lib/prisma";
import { PUBLIC_CAST_WHERE, PRIMARY_STORE_INCLUDE, castsOfStore, primaryStoreOf } from "@/lib/cast";

export async function getUserBalance(userId: string): Promise<number> {
  const [granted, gifted, reset] = await Promise.all([
    prisma.pointLedger.aggregate({
      where: { type: "GRANT", toUserId: userId },
      _sum: { amount: true },
    }),
    prisma.pointLedger.aggregate({
      where: { type: "GIFT", fromUserId: userId },
      _sum: { amount: true },
    }),
    prisma.pointLedger.aggregate({
      where: { type: "MONTHLY_RESET", toUserId: userId },
      _sum: { amount: true },
    }),
  ]);
  return (granted._sum.amount ?? 0) - (gifted._sum.amount ?? 0) - (reset._sum.amount ?? 0);
}

export async function getCumulativeGrantTotal(userId: string): Promise<number> {
  const result = await prisma.pointLedger.aggregate({
    where: { type: "GRANT", toUserId: userId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/**
 * 指定月のキャスト別ギフト合計を castId => 合計 で返す。
 * HPの表示順（lib/castOrder.ts）が使う。ランキング表示用の
 * getMonthlyRanking と違い、並べ替えに必要な数字だけを集計する。
 */
export async function getMonthlyGiftTotals(
  year: number,
  month: number // 1-indexed
): Promise<Map<string, number>> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const rows = await prisma.pointLedger.groupBy({
    by: ["castId"],
    where: { type: "GIFT", createdAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  return new Map(
    rows
      .filter((r): r is typeof r & { castId: string } => r.castId !== null)
      .map(r => [r.castId, r._sum.amount ?? 0])
  );
}

export async function getCastRanking(storeId?: string) {
  const casts = await prisma.cast.findMany({
    where: { ...PUBLIC_CAST_WHERE, ...(storeId ? castsOfStore(storeId) : {}) },
    include: {
      ledgerItems: { where: { type: "GIFT" }, select: { amount: true } },
      ...PRIMARY_STORE_INCLUDE,
    },
  });

  return casts
    .map((cast) => ({
      id: cast.id,
      name: cast.name,
      imageUrl: cast.imageUrl,
      storeName: primaryStoreOf(cast).name,
      storeSlug: primaryStoreOf(cast).slug,
      totalPoints: cast.ledgerItems.reduce((s, l) => s + l.amount, 0),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getMonthlyRanking(
  storeId?: string,
  year?: number,
  month?: number // 1-indexed (1=January)
) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = (month ?? now.getMonth() + 1) - 1; // 0-indexed for Date constructor

  const startOfMonth = new Date(y, m, 1);
  const endOfMonth = new Date(y, m + 1, 1);

  const casts = await prisma.cast.findMany({
    where: { ...PUBLIC_CAST_WHERE, ...(storeId ? castsOfStore(storeId) : {}) },
    include: {
      ledgerItems: {
        where: {
          type: "GIFT",
          createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
        select: { amount: true },
      },
      ...PRIMARY_STORE_INCLUDE,
    },
  });

  return casts
    .map((cast) => ({
      id: cast.id,
      name: cast.name,
      imageUrl: cast.imageUrl,
      storeName: primaryStoreOf(cast).name,
      storeSlug: primaryStoreOf(cast).slug,
      totalPoints: cast.ledgerItems.reduce((s, l) => s + l.amount, 0),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getUserTitle(userId: string) {
  const cumulativeTotal = await getCumulativeGrantTotal(userId);
  const titles = await prisma.title.findMany({ orderBy: { threshold: "desc" } });
  const current = titles.find((t) => cumulativeTotal >= t.threshold) ?? null;
  const next =
    [...titles].reverse().find((t) => t.threshold > cumulativeTotal) ?? null;
  return {
    current,
    next,
    cumulativeTotal,
    pointsToNext: next ? next.threshold - cumulativeTotal : null,
  };
}
