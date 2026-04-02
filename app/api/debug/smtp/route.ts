import { NextResponse } from "next/server";

/**
 * サーバー内で SMTP 環境変数が読めているか確認する用。
 * 本番では認証をかけるか、確認後に削除推奨。
 */
export async function GET() {
  const smtpHost = !!process.env.SMTP_HOST;
  const smtpUser = !!process.env.SMTP_USER;
  const smtpPass = !!process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@test.vliverlab.com";
  return NextResponse.json({
    smtpConfigured: smtpHost && smtpUser && smtpPass,
    smtpHostSet: smtpHost,
    smtpUserSet: smtpUser,
    smtpPassSet: smtpPass,
    from,
    host: smtpHost ? process.env.SMTP_HOST : "(not set)",
  });
}
