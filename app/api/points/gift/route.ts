import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { GiftPointsSchema } from "@/lib/validations";
import { getUserBalance } from "@/lib/points";
import { parseFavoriteCastIds } from "@/lib/favorite-casts";

async function appendFavoriteCast(userId: string, castId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteCastIds: true },
  });
  const ids = parseFavoriteCastIds(u?.favoriteCastIds);
  if (ids.includes(castId)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { favoriteCastIds: [...ids, castId] },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = GiftPointsSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { castId, amount, idempotencyKey, addToFavorites } = parsed.data;

  const cast = await prisma.cast.findUnique({ where: { id: castId } });
  if (!cast) {
    return NextResponse.json({ error: "キャストが見つかりません" }, { status: 404 });
  }

  const balance = await getUserBalance(session.userId);
  if (balance < amount) {
    return NextResponse.json({ error: "ポイントが不足しています" }, { status: 400 });
  }

  const existing = await prisma.pointLedger.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (addToFavorites) await appendFavoriteCast(session.userId, castId);
    return NextResponse.json({ message: "Already processed", ledger: existing });
  }

  const ledger = await prisma.pointLedger.create({
    data: {
      type: "GIFT",
      amount,
      fromUserId: session.userId,
      castId,
      idempotencyKey,
    },
  });

  if (addToFavorites) await appendFavoriteCast(session.userId, castId);

  return NextResponse.json({ ledger }, { status: 201 });
}
