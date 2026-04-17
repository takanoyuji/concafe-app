import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { GrantPointsSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = GrantPointsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
  }

  const { toUserId, email, amount, idempotencyKey } = parsed.data;

  try {
    const target = toUserId
      ? await prisma.user.findUnique({ where: { id: toUserId } })
      : await prisma.user.findUnique({ where: { email: email! } });

    if (!target || target.role !== "CUSTOMER") {
      return NextResponse.json({ error: "対象の会員が見つかりません（ADMINは付与対象外）" }, { status: 404 });
    }

    const existing = await prisma.pointLedger.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return NextResponse.json({ message: "Already processed", ledger: existing });
    }

    const ledger = await prisma.pointLedger.create({
      data: {
        type: "GRANT",
        amount,
        fromUserId: session.userId,
        toUserId: target.id,
        idempotencyKey,
      },
    });

    return NextResponse.json({ ledger }, { status: 201 });
  } catch (e) {
    console.error("[grant] error:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
