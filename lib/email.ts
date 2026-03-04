import nodemailer from "nodemailer";

function getTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
}

const FROM = process.env.SMTP_FROM ?? "noreply@test.xing-lang.com";
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${BASE}/api/auth/verify-email?token=${token}`;
  const transport = getTransport();

  if (!transport) {
    console.log(`\n[DEV EMAIL] メール認証リンク for ${email}:\n${url}\n`);
    return;
  }

  try {
  await transport.sendMail({
    from: `星狼 <${FROM}>`,
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
  } catch (err) {
    console.error("[EMAIL] sendVerificationEmail failed:", err);
    throw err;
  }
}

/** SMTP未設定時はリセットリンクを返す（画面表示用）。送信時は undefined */
export async function sendPasswordResetEmail(email: string, token: string): Promise<{ resetLink?: string }> {
  const url = `${BASE}/auth/reset-password?token=${token}`;
  const transport = getTransport();

  if (!transport) {
    console.log(`\n[DEV EMAIL] パスワードリセットリンク for ${email}:\n${url}\n`);
    return { resetLink: url };
  }

  try {
  await transport.sendMail({
    from: `星狼 <${FROM}>`,
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
  } catch (err) {
    console.error("[EMAIL] sendPasswordResetEmail failed:", err);
    throw err;
  }
}
