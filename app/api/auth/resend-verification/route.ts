import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "メールアドレスが必要です" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // ユーザーが存在しない・既に認証済みの場合も成功を返す（列挙攻撃対策）
    if (!user || user.emailVerified) {
      return NextResponse.json({ message: "送信しました" });
    }

    // 古いトークンを削除して新規作成
    await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
    const token = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    try {
      await sendVerificationEmail(email, token);
    } catch (emailErr) {
      console.error("[RESEND] メール送信失敗:", emailErr);
    }

    return NextResponse.json({ message: "送信しました" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
