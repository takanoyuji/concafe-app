import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { sendCastInviteEmail } from "@/lib/email";

/**
 * POST /api/admin/permissions/invite  { email }
 * キャストマスタに無い店長を招待する（OWNER だけ）。受諾すると role=MANAGER のユーザーになる
 */
export async function POST(req: Request) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
  }
  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.castInviteToken.create({ data: { castId: null, email, role: "MANAGER", tokenHash, expiresAt } });
  const devUrl = await sendCastInviteEmail(email, "", raw, "MANAGER");
  return NextResponse.json({ ok: true, email, role: "MANAGER", expiresAt, ...(devUrl ? { devUrl } : {}) });
}
