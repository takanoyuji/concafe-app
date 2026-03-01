import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validations";
import { createSessionToken, setSessionCookie, SessionPayload } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "入力が正しくありません" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "メールアドレスの認証が完了していません" },
        { status: 403 }
      );
    }

    const payload: SessionPayload = {
      userId: user.id,
      role: user.role as "CUSTOMER" | "ADMIN",
      emailVerified: user.emailVerified,
      mustChangePassword: user.mustChangePassword,
    };

    const token = await createSessionToken(payload);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword },
    });
    setSessionCookie(response, token);
    return response;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
