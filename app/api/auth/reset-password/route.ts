import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ResetPasswordSchema } from "@/lib/validations";
import { getSession, createSessionToken, setSessionCookie, SessionPayload } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { token, password } = parsed.data;

    let userId: string | null = null;

    if (token === "__session__") {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      userId = session.userId;
    } else {
      const record = await prisma.passwordResetToken.findUnique({ where: { token } });
      if (!record) {
        return NextResponse.json({ error: "無効なトークンです" }, { status: 400 });
      }
      if (record.expiresAt < new Date()) {
        await prisma.passwordResetToken.delete({ where: { token } });
        return NextResponse.json({ error: "トークンが期限切れです" }, { status: 400 });
      }
      userId = record.userId;
      await prisma.passwordResetToken.delete({ where: { token } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    const payload: SessionPayload = {
      userId: updatedUser.id,
      role: updatedUser.role as "CUSTOMER" | "ADMIN",
      emailVerified: updatedUser.emailVerified,
      mustChangePassword: false,
    };

    const newToken = await createSessionToken(payload);
    const response = NextResponse.json({ message: "パスワードを変更しました" });
    setSessionCookie(response, newToken);
    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
