import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/**
 * 旧方式（リンクで受諾）の招待。新規発行は止めたが、送付済みの未使用分が残っている。
 * GET … 未使用で期限内の一覧 / DELETE ?id= … 取り消し（期限切れにする）。OWNER だけ
 */
export async function GET() {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const rows = await prisma.castInviteToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    include: { cast: { select: { name: true, castCode: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tokens: rows.map(r => ({ id: r.id, email: r.email, role: r.role, cast: r.cast, expiresAt: r.expiresAt, createdAt: r.createdAt })) });
}

export async function DELETE(req: Request) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });
  await prisma.castInviteToken.updateMany({ where: { id, usedAt: null }, data: { expiresAt: new Date(0) } });
  return NextResponse.json({ ok: true });
}
