import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCastInviteEmail } from "@/lib/email";

/**
 * POST /api/admin/cast-master/[id]/invite  { email }
 *
 * キャストを招待する（docs/cast-portal-requirements.md 3章）。
 * - 既にアカウントが結ばれているキャストは招待しない
 * - 客（CUSTOMER）や他のユーザーが使っているメールは拒否（購入履歴・ポイントと混ぜない）
 * - トークンは SHA-256 のハッシュで保存し、7日で失効。未使用の古い招待は失効させてから発行する
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  const cast = await prisma.cast.findUnique({ where: { id } });
  if (!cast) return NextResponse.json({ error: "キャストが見つかりません" }, { status: 404 });
  if (cast.retired) return NextResponse.json({ error: "退職済みのキャストは招待できません" }, { status: 400 });
  if (cast.userId) return NextResponse.json({ error: "このキャストには既にアカウントが結ばれています" }, { status: 409 });

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    return NextResponse.json(
      { error: "このメールアドレスは既に会員登録に使われています。キャスト用には別のメールアドレスを使ってください" },
      { status: 409 }
    );
  }

  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await prisma.$transaction([
    // 未使用の古い招待は失効させる（有効なリンクを1本にする）
    prisma.castInviteToken.updateMany({ where: { castId: cast.id, usedAt: null }, data: { expiresAt: new Date(0) } }),
    prisma.castInviteToken.create({ data: { castId: cast.id, email, tokenHash, expiresAt } }),
  ]);

  const devUrl = await sendCastInviteEmail(email, cast.name, raw);
  return NextResponse.json({ ok: true, email, expiresAt, ...(devUrl ? { devUrl } : {}) });
}
