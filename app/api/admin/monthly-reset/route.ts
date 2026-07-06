import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/points";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // JST (UTC+9) で月を計算する（cronがJST 5時に実行されるためUTCだと前月になるバグ対策）
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth() + 1; // 1-indexed
  const monthStr = month.toString().padStart(2, "0");

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: { id: true, email: true },
  });

  const logs: { userId: string; email: string; amount: number }[] = [];
  let resetCount = 0;

  for (const user of customers) {
    const balance = await getUserBalance(user.id);
    if (balance <= 0) continue;

    const idempotencyKey = `MONTHLY_RESET-${user.id}-${year}-${monthStr}`;

    // idempotencyKeyで既存レコードをチェック
    const existing = await prisma.pointLedger.findFirst({
      where: { idempotencyKey },
    });
    if (existing) continue;

    await prisma.pointLedger.create({
      data: {
        type: "MONTHLY_RESET",
        amount: balance,
        toUserId: user.id,
        idempotencyKey,
      },
    });

    logs.push({ userId: user.id, email: user.email, amount: balance });
    resetCount++;
  }

  return NextResponse.json({ resetCount, logs });
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const resets = await prisma.pointLedger.findMany({
    where: { type: "MONTHLY_RESET" },
    orderBy: { createdAt: "desc" },
    include: {
      toUser: { select: { email: true } },
    },
  });

  const items = resets.map((r) => ({
    id: r.id,
    userId: r.toUserId,
    email: r.toUser?.email ?? null,
    amount: r.amount,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ resets: items });
}
