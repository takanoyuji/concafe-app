import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : null;

    if (!email) {
      return NextResponse.json({ success: false, error: "email が必要です" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ success: false, error: "RESEND_API_KEY が未設定です" }, { status: 500 });
    }

    await sendEmail({
      to: email,
      subject: "【星狼】テスト送信",
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
          <h2>星狼 テストメール</h2>
          <p>これはテストメールです。届いていれば Resend の送信設定は正常です。</p>
        </div>
      `,
      text: "これはテストメールです。届いていれば Resend の送信設定は正常です。",
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[TEST EMAIL] 送信失敗:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
