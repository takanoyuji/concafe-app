import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { GiftPointsSchema } from "@/lib/validations";
import { getUserBalance } from "@/lib/points";

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

  const { castId, amount, idempotencyKey } = parsed.data;

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

  return NextResponse.json({ ledger }, { status: 201 });
}
