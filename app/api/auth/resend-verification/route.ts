import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  let email: string;
  try {
    const body = await req.json();
    if (typeof body.email !== "string" || !body.email.includes("@")) {
      return NextResponse.json({ error: "メールアドレスが不正です" }, { status: 400 });
    }
    email = body.email.toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  // ユーザー存在・認証済みチェック（メールアドレス列挙対策: どちらも同じ 200 を返す）
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    return NextResponse.json({ message: "確認メールを送信しました（登録済みかつ未認証の場合）" });
  }

  // 既存トークンを削除して新しいトークンを発行
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // メール送信（失敗しても 500 にしない）
  let emailSent = true;
  try {
    await sendVerificationEmail(email, token);
    console.log("[RESEND-VERIFY] メール送信完了:", email);
  } catch (err) {
    emailSent = false;
    console.error("[RESEND-VERIFY] メール送信失敗:", err);
  }

  return NextResponse.json({
    message: emailSent
      ? "確認メールを再送しました。メールのリンクから認証を完了してください。"
      : "メールの送信に失敗しました。しばらくしてから再度お試しください。",
    emailSent,
  });
}
