import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

/**
 * テスト送信を実行し、成功/失敗とエラー内容を返す。原因特定用。
 * 本番では認証をかけるか、確認後に削除すること。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const to = typeof body.to === "string" ? body.to : process.env.SMTP_FROM ?? "noreply@test.xing-lang.com";

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM ?? "noreply@test.xing-lang.com";

    if (!host || !user || !pass) {
      return NextResponse.json({
        ok: false,
        error: "SMTP未設定",
        detail: {
          SMTP_HOST: !!host,
          SMTP_USER: !!user,
          SMTP_PASS: !!pass,
          from,
        },
      });
    }

    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: { user, pass },
    });

    await transport.sendMail({
      from: `星狼 <${from}>`,
      to,
      subject: "【星狼】テスト送信",
      text: "これはテストメールです。届いていれば送信設定は正常です。",
    });

    return NextResponse.json({ ok: true, message: "送信しました", to });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[DEBUG] send-test-email failed:", err);
    return NextResponse.json({
      ok: false,
      error: message,
      ...(process.env.NODE_ENV !== "production" && stack && { stack }),
    }, { status: 500 });
  }
}
