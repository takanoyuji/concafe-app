import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { SignupSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  // 1. バリデーション
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  // 2. DB 操作（ここのエラーは 500 にする）
  let token: string;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "このメールアドレスはすでに使用されています" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "CUSTOMER" },
    });

    token = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (e) {
    console.error("[SIGNUP] DBエラー:", e);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }

  // 3. メール送信（失敗しても 500 にしない — ユーザーは作成済み）
  console.log("[SIGNUP] ユーザー作成完了。メール送信開始:", email);
  let emailSent = true;
  try {
    await sendVerificationEmail(email, token);
    console.log("[SIGNUP] メール送信完了:", email);
  } catch (emailErr) {
    emailSent = false;
    console.error("[SIGNUP] メール送信失敗 (登録は完了):", emailErr);
  }

  return NextResponse.json(
    {
      message: emailSent
        ? "確認メールを送信しました。メールのリンクから認証を完了してください。"
        : "登録は完了しましたが、確認メールの送信に失敗しました。しばらくしてから再度お試しいただくか、サポートへお問い合わせください。",
      emailSent,
    },
    { status: 201 }
  );
}
