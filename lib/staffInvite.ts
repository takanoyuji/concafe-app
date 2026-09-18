/**
 * スタッフ（店長 / キャスト）の招待 — 初期パスワード方式（2026-09-18 代表判断）。
 *
 * 誤ったメールアドレスに招待を送っても、届いた人が中を見られないようにする:
 *   - アカウントは招待時に作る（role・mustChangePassword=true・初期PWの期限=72時間）
 *   - 本人にはメールで「ログインIDとURL」だけ。**初期パスワードはメールに載せない**。
 *     管理画面に1回だけ表示し、店長がLINEや口頭で別に渡す（再表示は不可、再発行のみ）
 *   - 初回ログインでパスワード変更を必須にする（既存の mustChangePassword の仕組み）
 *   - 72時間以内に一度もログインが無ければ失効（ログインを拒否。再発行で延ばす）
 *   - 間違いに気づいたら、未ログインなら削除、ログイン済みなら停止 / キャストから切り離す（権限管理）
 *
 * 旧方式（リンクで受諾する CastInviteToken）は新規発行を止めた。既に送った分の受諾は残してある。
 */
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendStaffInviteEmail } from "@/lib/email";

export const INITIAL_PASSWORD_TTL_MS = 72 * 3600 * 1000;

/** 読み間違えにくい文字だけ（0/O, 1/l/I を除く）。12桁 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
export function generateInitialPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export class InviteError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 400) { super(message); this.name = "InviteError"; }
}

/**
 * 招待してアカウントを作る。戻り値の initialPassword は呼び出し元が1回だけ表示する。
 * @param castId キャストマスタの行に結ぶとき。店長で無い場合は null
 */
export async function inviteStaff(params: {
  email: string;
  emailConfirm: string;
  role: "CAST" | "MANAGER";
  castId: string | null;
  invitedByUserId: string;
}): Promise<{ userId: string; email: string; role: "CAST" | "MANAGER"; initialPassword: string; expiresAt: Date; castName: string | null; devMailUrl?: string }> {
  const email = params.email.trim().toLowerCase();
  const confirm = params.emailConfirm.trim().toLowerCase();
  if (!isValidEmail(email)) throw new InviteError("メールアドレスの形式が正しくありません");
  if (email !== confirm) throw new InviteError("確認用のメールアドレスが一致しません。打ち間違いを防ぐため、同じものを2回入力してください");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new InviteError("このメールアドレスは既に登録されています（客の会員登録を含む）。別のメールアドレスを使ってください", 409);
  }

  let castName: string | null = null;
  if (params.castId) {
    const cast = await prisma.cast.findUnique({ where: { id: params.castId }, select: { id: true, name: true, retired: true, userId: true } });
    if (!cast) throw new InviteError("キャストが見つかりません");
    if (cast.retired) throw new InviteError("退職済みのキャストは招待できません");
    if (cast.userId) throw new InviteError("このキャストには既にアカウントが結ばれています。先に権限管理で切り離してください", 409);
    castName = cast.name;
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await bcrypt.hash(initialPassword, 10);
  const expiresAt = new Date(Date.now() + INITIAL_PASSWORD_TTL_MS);

  const user = await prisma.$transaction(async tx => {
    const u = await tx.user.create({
      data: {
        email, passwordHash, role: params.role, emailVerified: true, mustChangePassword: true,
        name: castName, invitedByUserId: params.invitedByUserId, invitedAt: new Date(), initialPasswordExpiresAt: expiresAt,
      },
    });
    if (params.castId) await tx.cast.update({ where: { id: params.castId }, data: { userId: u.id } });
    return u;
  });

  const devMailUrl = await sendStaffInviteEmail(email, castName ?? "", params.role);
  return { userId: user.id, email, role: params.role, initialPassword, expiresAt, castName, devMailUrl };
}

/** 初期パスワードを作り直す（未ログインの人だけ）。期限も延ばす */
export async function reissueInitialPassword(userId: string): Promise<{ initialPassword: string; expiresAt: Date }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, lastLoginAt: true, role: true } });
  if (!user) throw new InviteError("ユーザーが見つかりません");
  if (user.role === "CUSTOMER" || user.role === "OWNER" || user.role === "ADMIN") throw new InviteError("この操作は店長・キャストのアカウントだけです");
  if (user.lastLoginAt) throw new InviteError("既にログイン済みのアカウントです。パスワードは本人が「パスワードを忘れた方」から再設定してください");
  const initialPassword = generateInitialPassword();
  const expiresAt = new Date(Date.now() + INITIAL_PASSWORD_TTL_MS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(initialPassword, 10), mustChangePassword: true, initialPasswordExpiresAt: expiresAt, disabledAt: null },
  });
  return { initialPassword, expiresAt };
}

/** ログインを通してよいか。初期PWの期限切れ・停止を弾く（ログインAPIから使う） */
export function loginBlockReason(user: { role: string; lastLoginAt: Date | null; initialPasswordExpiresAt: Date | null; disabledAt: Date | null }): string | null {
  if (user.disabledAt) return "このアカウントは停止されています。店舗に連絡してください";
  if (!user.lastLoginAt && user.initialPasswordExpiresAt && user.initialPasswordExpiresAt < new Date()) {
    return "初期パスワードの有効期限（3日）が切れています。店舗に再発行を依頼してください";
  }
  return null;
}
