import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FEATURES, getPermissionTable, clearPermissionCache, type Feature } from "@/lib/permissions";
import { normalizeRole, ROLE_LABEL } from "@/lib/permissions";

/** GET /api/admin/permissions — 機能 × ロールの表と、スタッフ一覧（OWNER だけ） */
export async function GET() {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const [table, users] = await Promise.all([
    getPermissionTable(),
    prisma.user.findMany({
      where: { role: { in: ["OWNER", "ADMIN", "MANAGER", "CAST"] } },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const casts = await prisma.cast.findMany({ where: { userId: { not: null } }, select: { userId: true, name: true, castCode: true } });
  const castByUser = new Map(casts.map(c => [c.userId!, c]));
  return NextResponse.json({
    features: FEATURES,
    table,
    staff: users.map(u => {
      const role = normalizeRole(u.role);
      return { id: u.id, email: u.email, name: u.name, role, roleLabel: ROLE_LABEL[role], cast: castByUser.get(u.id) ?? null, createdAt: u.createdAt };
    }),
  });
}

/**
 * PUT /api/admin/permissions  { role: "MANAGER"|"CAST", feature, allowed }
 * 1マスずつ更新する（誤操作で一気に変わらないように）。permissions 機能は OWNER 固定で変えられない
 */
export async function PUT(req: Request) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  const role = body.role === "MANAGER" ? "MANAGER" : body.role === "CAST" ? "CAST" : null;
  const feature = FEATURES.find(f => f.key === body.feature)?.key as Feature | undefined;
  if (!role || !feature) return NextResponse.json({ error: "role / feature が正しくありません" }, { status: 400 });
  if (feature === "permissions") return NextResponse.json({ error: "権限管理はオーナー専用で変更できません" }, { status: 400 });
  const allowed = Boolean(body.allowed);
  await prisma.rolePermission.upsert({
    where: { role_feature: { role, feature } },
    create: { role, feature, allowed },
    update: { allowed },
  });
  clearPermissionCache();
  return NextResponse.json({ ok: true, table: await getPermissionTable() });
}
