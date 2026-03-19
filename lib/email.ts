import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.MAIL_FROM ?? "星狼 <info@mail.xing-lang.com>";
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/** 共通メール送信関数 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  if (error) {
    console.error("[EMAIL] 送信失敗:", { to, subject, error });
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }

  console.log("[EMAIL] 送信成功 message_id:", data?.id, "to:", to);
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE}/api/auth/verify-email?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV EMAIL] メール認証リンク for ${email}:\n${url}\n`);
    return;
  }

  await sendEmail({
    to: email,
    subject: "【星狼】メールアドレスの確認",
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2>星狼 メール認証</h2>
        <p>以下のリンクをクリックしてメールアドレスを認証してください。</p>
        <p><a href="${url}" style="background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">メールアドレスを認証する</a></p>
        <p style="color:#666;font-size:12px">このリンクは24時間有効です。</p>
      </div>
    `,
  });
}

/** Resend未設定時はリセットリンクを返す（画面表示用）。送信時は undefined */
export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<{ resetLink?: string }> {
  const url = `${BASE}/auth/reset-password?token=${token}`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV EMAIL] パスワードリセットリンク for ${email}:\n${url}\n`);
    return { resetLink: url };
  }

  await sendEmail({
    to: email,
    subject: "【星狼】パスワードリセット",
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2>星狼 パスワードリセット</h2>
        <p>以下のリンクからパスワードをリセットしてください。</p>
        <p><a href="${url}" style="background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">パスワードをリセットする</a></p>
        <p style="color:#666;font-size:12px">このリンクは1時間有効です。</p>
      </div>
    `,
  });

  return {};
}
