import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance } from "@/lib/points";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    select: { id: true, email: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const withBalance = await Promise.all(
    users.map(async (u) => ({
      ...u,
      balance: await getUserBalance(u.id),
    }))
  );

  return NextResponse.json({ users: withBalance });
}
