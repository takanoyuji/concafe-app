import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // N+1を避けるため、ユーザー・残高・キャスト名を一括取得
  const [users, grantLedgers, giftLedgers, resetLedgers, allCasts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: { id: true, email: true, emailVerified: true, birthdate: true, ageVerified: true, createdAt: true, name: true, favoriteCast1Id: true, favoriteCast2Id: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pointLedger.groupBy({
      by: ["toUserId"],
      where: { type: "GRANT", toUserId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.pointLedger.groupBy({
      by: ["fromUserId"],
      where: { type: "GIFT", fromUserId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.pointLedger.groupBy({
      by: ["toUserId"],
      where: { type: "MONTHLY_RESET", toUserId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.cast.findMany({ select: { id: true, name: true } }),
  ]);

  const grantMap = new Map(grantLedgers.map(l => [l.toUserId!, l._sum.amount ?? 0]));
  const giftMap = new Map(giftLedgers.map(l => [l.fromUserId!, l._sum.amount ?? 0]));
  const resetMap = new Map(resetLedgers.map(l => [l.toUserId!, l._sum.amount ?? 0]));
  const castMap = new Map(allCasts.map(c => [c.id, c.name]));

  const withBalance = users.map(u => ({
    ...u,
    balance: (grantMap.get(u.id) ?? 0) - (giftMap.get(u.id) ?? 0) - (resetMap.get(u.id) ?? 0),
    favoriteCast1Name: u.favoriteCast1Id ? (castMap.get(u.favoriteCast1Id) ?? null) : null,
    favoriteCast2Name: u.favoriteCast2Id ? (castMap.get(u.favoriteCast2Id) ?? null) : null,
  }));

  return NextResponse.json({ users: withBalance });
}
