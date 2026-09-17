import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie, type SessionPayload } from "@/lib/auth";

const INVALID = "この招待リンクは無効か、期限が切れています";

/** GET /api/cast/invite?token= — 招待の有効性とキャスト名（パスワード設定画面の表示用） */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const invite = await findValidInvite(token);
  if (!invite) return NextResponse.json({ error: INVALID }, { status: 400 });
  return NextResponse.json({ castName: invite.cast.name, email: invite.email });
}

/**
 * POST /api/cast/invite  { token, password }
 * パスワードを設定して User(role=CAST) を作り、Cast.userId に結ぶ。そのままログイン状態にする
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  if (password.length < 8) return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });

  const invite = await findValidInvite(token);
  if (!invite) return NextResponse.json({ error: INVALID }, { status: 400 });
  if (invite.cast.userId) return NextResponse.json({ error: "このキャストには既にアカウントがあります。ログインしてください" }, { status: 409 });
  if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
    return NextResponse.json({ error: "このメールアドレスは既に使われています。店舗に連絡してください" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async tx => {
    // 使用済みにするのを先に。同時に2回押されても1回しか通らない
    const used = await tx.castInviteToken.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new Error("already used");
    const u = await tx.user.create({
      data: { email: invite.email, passwordHash, role: "CAST", emailVerified: true, name: invite.cast.name },
    });
    await tx.cast.update({ where: { id: invite.castId }, data: { userId: u.id } });
    return u;
  }).catch(() => null);
  if (!user) return NextResponse.json({ error: INVALID }, { status: 400 });

  const payload: SessionPayload = { userId: user.id, role: "CAST", emailVerified: true, mustChangePassword: false };
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, await createSessionToken(payload));
  return res;
}

async function findValidInvite(token: string) {
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await prisma.castInviteToken.findUnique({ where: { tokenHash }, include: { cast: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
  return invite;
}
