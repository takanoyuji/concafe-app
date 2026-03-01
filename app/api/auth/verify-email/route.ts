import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "トークンが必要です" }, { status: 400 });
  }

  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) {
    return NextResponse.json({ error: "無効なトークンです" }, { status: 400 });
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerificationToken.delete({ where: { token } });
    return NextResponse.json({ error: "トークンが期限切れです" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });

  await prisma.emailVerificationToken.delete({ where: { token } });

  // 認証完了ページにリダイレクト
  return NextResponse.redirect(
    new URL("/auth/login?verified=1", req.nextUrl.origin)
  );
}
