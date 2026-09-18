import { Resend } from "resend";

// ビルド時（page data collection）に API キーが無い環境でも落ちないよう遅延生成する
let resendClient: Resend | null = null;
function getResend() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}
const FROM = process.env.MAIL_FROM ?? "星狼 <info@mail.xing-lang.com>";
// NEXT_PUBLIC_ はビルド時に焼き込まれるため、サーバー専用URLは APP_URL を使う
const BASE = process.env.APP_URL ?? "http://localhost:3000";

const SEND_TIMEOUT_MS = 10_000; // 10 秒でタイムアウト

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
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`メール送信タイムアウト (${SEND_TIMEOUT_MS}ms)`)),
      SEND_TIMEOUT_MS
    );
  });

  const send = getResend().emails.send({
    from: FROM,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });

  try {
    const { data, error } = await Promise.race([send, timeout]);

    if (error) {
      console.error("[EMAIL] 送信失敗:", { to, subject, error });
      throw new Error(`メール送信に失敗しました: ${error.message}`);
    }

    console.log("[EMAIL] 送信成功 message_id:", data?.id, "to:", to);
  } finally {
    clearTimeout(timerId);
  }
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

// ---- 席予約の通知（要件書 10章・2026-09-12） --------------------------------
// 受付時と、店舗が「確定」「お断り」にしたときに送る。
// ⚠️ 呼び出し側で失敗を握る。送れなかったからといって予約や状態変更を失敗させない
//    （LINEでの手動連絡も続けるので、メールは二重の連絡手段という位置づけ）。

export type ReservationMailInfo = {
  to: string;
  storeName: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  customerName: string;
  /** 店舗からお客様へのメッセージ（任意）。あればメールに「店舗からのメッセージ」として載せる */
  message?: string;
};

function staffMessageHtml(r: ReservationMailInfo) {
  if (!r.message) return "";
  return `
    <div style="margin:16px 0;padding:12px 16px;background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:4px">
      <p style="margin:0 0 6px;color:#666;font-size:12px">店舗からのメッセージ</p>
      <p style="margin:0;white-space:pre-wrap">${escapeHtml(r.message)}</p>
    </div>`;
}
function staffMessageText(r: ReservationMailInfo) {
  return r.message ? `\n【店舗からのメッセージ】\n${r.message}\n` : "";
}

function reservationSummaryHtml(r: ReservationMailInfo) {
  return `
    <table style="border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:4px 12px 4px 0;color:#666">店舗</td><td style="padding:4px 0">${escapeHtml(r.storeName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">来店日時</td><td style="padding:4px 0">${escapeHtml(r.visitDate)} ${escapeHtml(r.visitTime)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">人数</td><td style="padding:4px 0">${r.partySize}名</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">お名前</td><td style="padding:4px 0">${escapeHtml(r.customerName)} 様</td></tr>
    </table>`;
}

function reservationSummaryText(r: ReservationMailInfo) {
  return [
    `店舗: ${r.storeName}`,
    `来店日時: ${r.visitDate} ${r.visitTime}`,
    `人数: ${r.partySize}名`,
    `お名前: ${r.customerName} 様`,
  ].join("\n");
}

function wrap(title: string, bodyHtml: string) {
  return `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;line-height:1.7">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
      <p style="color:#666;font-size:12px;margin-top:24px">
        このメールは送信専用です。お問い合わせは公式LINEのトークからお願いいたします。
      </p>
    </div>`;
}

/** 申し込み受付。まだ確定していないことをはっきり書く */
export async function sendReservationReceivedEmail(r: ReservationMailInfo) {
  const subject = "【星狼】ご予約のお申し込みを受け付けました";
  const html = wrap("ご予約のお申し込みを受け付けました", `
    <p>${escapeHtml(r.customerName)} 様</p>
    <p>以下の内容でご予約のお申し込みを受け付けました。</p>
    ${reservationSummaryHtml(r)}
    <p><strong>この時点ではまだご予約は確定していません。</strong><br>
    店舗が内容を確認し、確定またはお受けできない旨をメールと公式LINEでご連絡いたします。</p>
    <p style="font-size:13px;color:#444">会員登録済みの方は、<a href="${BASE}/me/reservations">マイページ</a>から予約の状況を確認できます。</p>
  `);
  const text = `${r.customerName} 様\n\n以下の内容でご予約のお申し込みを受け付けました。\n\n${reservationSummaryText(r)}\n\nこの時点ではまだご予約は確定していません。店舗が内容を確認し、確定またはお受けできない旨をメールと公式LINEでご連絡いたします。\n\n会員登録済みの方はマイページから予約の状況を確認できます: ${BASE}/me/reservations`;
  await sendReservationMail(r.to, subject, html, text);
}

/** 店舗が承認した */
export async function sendReservationConfirmedEmail(r: ReservationMailInfo) {
  const subject = "【星狼】ご予約が確定しました";
  const html = wrap("ご予約が確定しました", `
    <p>${escapeHtml(r.customerName)} 様</p>
    <p>以下の内容でご予約を承りました。ご来店をお待ちしております。</p>
    ${reservationSummaryHtml(r)}
    ${staffMessageHtml(r)}
    <p>ご来店時に年齢確認をさせていただきます。身分証をお持ちください。</p>
    <p>ご来店時間の変更・キャンセルは、公式LINEのトークからご連絡ください。</p>
  `);
  const text = `${r.customerName} 様\n\n以下の内容でご予約を承りました。ご来店をお待ちしております。\n\n${reservationSummaryText(r)}\n${staffMessageText(r)}\nご来店時に年齢確認をさせていただきます。身分証をお持ちください。\nご来店時間の変更・キャンセルは、公式LINEのトークからご連絡ください。`;
  await sendReservationMail(r.to, subject, html, text);
}

/** 店舗が受けられなかった（満席・営業時間外など）。理由は書かず、再申し込みの案内だけ */
export async function sendReservationDeclinedEmail(r: ReservationMailInfo) {
  const subject = "【星狼】ご予約についてのご案内";
  const html = wrap("ご予約についてのご案内", `
    <p>${escapeHtml(r.customerName)} 様</p>
    <p>誠に申し訳ございません。以下のお申し込みは、満席等の理由によりお受けすることができませんでした。</p>
    ${reservationSummaryHtml(r)}
    ${staffMessageHtml(r)}
    <p>別の日時でのご来店をご検討いただける場合は、<a href="${BASE}/reserve">予約フォーム</a>からあらためてお申し込みください。</p>
  `);
  const text = `${r.customerName} 様\n\n誠に申し訳ございません。以下のお申し込みは、満席等の理由によりお受けすることができませんでした。\n\n${reservationSummaryText(r)}\n${staffMessageText(r)}\n別の日時でのご来店をご検討いただける場合は、予約フォームからあらためてお申し込みください: ${BASE}/reserve`;
  await sendReservationMail(r.to, subject, html, text);
}

async function sendReservationMail(to: string, subject: string, html: string, text: string) {
  if (!to) return;
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV EMAIL] ${subject} to ${to}\n${text}\n`);
    return;
  }
  await sendEmail({ to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * キャストの招待メール（docs/cast-portal-requirements.md 3章）。
 * Resend 未設定のときはリンクを返す（管理画面に出して手渡しできるようにする）
 */
export async function sendCastInviteEmail(email: string, castName: string, token: string, role: "CAST" | "MANAGER" = "CAST"): Promise<string | undefined> {
  const url = `${BASE}/cast/invite/${token}`;
  const what = role === "MANAGER" ? "店長用の管理画面" : "キャストページ";

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV EMAIL] キャスト招待リンク for ${email}:\n${url}\n`);
    return url;
  }

  await sendEmail({
    to: email,
    subject: `【星狼】${what}のご案内`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2>星狼 ${what}</h2>
        <p>${escapeHtml(castName || email)} さん</p>
        <p>${what}のアカウントをご用意しました。以下のリンクからパスワードを設定するとログインできます。</p>
        <p><a href="${url}" style="background:#7c3aed;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block">パスワードを設定する</a></p>
        <p style="color:#666;font-size:12px">このリンクは7日間有効です。心当たりがない場合はこのメールを破棄してください。</p>
      </div>
    `,
  });
  return undefined;
}

/**
 * スタッフ招待のメール（初期パスワード方式）。**パスワードは載せない**。
 * ログインIDとURLだけ。パスワードは店長が別経路（LINE / 口頭）で渡す。
 * Resend 未設定のときはリンクを返す（管理画面に出す）
 */
export async function sendStaffInviteEmail(email: string, castName: string, role: "CAST" | "MANAGER"): Promise<string | undefined> {
  const url = `${BASE}/auth/login`;
  const what = role === "MANAGER" ? "店長用の管理画面" : "キャストページ";

  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[DEV EMAIL] スタッフ招待（${role}） for ${email}: ${url}\n`);
    return url;
  }

  await sendEmail({
    to: email,
    subject: `【星狼】${what}のご案内`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
        <h2>星狼 ${what}</h2>
        <p>${escapeHtml(castName || email)} さん</p>
        <p>${what}のアカウントをご用意しました。</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#666">ログインID</td><td style="padding:4px 0">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">ログイン</td><td style="padding:4px 0"><a href="${url}">${url}</a></td></tr>
        </table>
        <p><strong>パスワードは店舗の担当者から別途お伝えします。</strong>このメールには含まれていません。</p>
        <p style="color:#666;font-size:12px">初回ログイン時にパスワードの変更をお願いします。3日以内にログインが無い場合は、お伝えしたパスワードは無効になります（担当者に再発行を依頼してください）。</p>
      </div>
    `,
  });
  return undefined;
}
