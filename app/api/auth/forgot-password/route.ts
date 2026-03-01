import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { ForgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
    }

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // ユーザーが存在しなくても同じレスポンスを返す（列挙攻撃対策）
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const token = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間
        },
      });
      await sendPasswordResetEmail(email, token);
    }

    return NextResponse.json({ message: "パスワードリセットメールを送信しました" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
