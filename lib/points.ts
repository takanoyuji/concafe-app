import { prisma } from "@/lib/prisma";

export async function getUserBalance(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [granted, gifted] = await Promise.all([
    prisma.pointLedger.aggregate({
      where: { type: "GRANT", toUserId: userId, createdAt: { gte: startOfMonth, lt: endOfMonth } },
      _sum: { amount: true },
    }),
    prisma.pointLedger.aggregate({
      where: { type: "GIFT", fromUserId: userId, createdAt: { gte: startOfMonth, lt: endOfMonth } },
      _sum: { amount: true },
    }),
  ]);
  return (granted._sum.amount ?? 0) - (gifted._sum.amount ?? 0);
}

export async function getCumulativeGiftTotal(userId: string): Promise<number> {
  const result = await prisma.pointLedger.aggregate({
    where: { type: "GIFT", fromUserId: userId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function getCastRanking(storeId?: string) {
  const casts = await prisma.cast.findMany({
    where: storeId ? { storeId } : undefined,
    include: {
      ledgerItems: { where: { type: "GIFT" }, select: { amount: true } },
      store: { select: { name: true, slug: true } },
    },
  });

  return casts
    .map((cast) => ({
      id: cast.id,
      name: cast.name,
      imageUrl: cast.imageUrl,
      storeName: cast.store.name,
      storeSlug: cast.store.slug,
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
    where: storeId ? { storeId } : undefined,
    include: {
      ledgerItems: {
        where: {
          type: "GIFT",
          createdAt: { gte: startOfMonth, lt: endOfMonth },
        },
        select: { amount: true },
      },
      store: { select: { name: true, slug: true } },
    },
  });

  return casts
    .map((cast) => ({
      id: cast.id,
      name: cast.name,
      imageUrl: cast.imageUrl,
      storeName: cast.store.name,
      storeSlug: cast.store.slug,
      totalPoints: cast.ledgerItems.reduce((s, l) => s + l.amount, 0),
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function getUserTitle(userId: string) {
  const cumulativeTotal = await getCumulativeGiftTotal(userId);
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
