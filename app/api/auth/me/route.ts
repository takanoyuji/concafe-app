import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRole, ROLE_LABEL, allowedFeatures, canAccessAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, role: true, emailVerified: true, mustChangePassword: true, createdAt: true },
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  // ロールは正規化して返す（旧 ADMIN → OWNER）。ラベルと使える機能は画面がサイドバー・バッジに使う。
  // 客（CUSTOMER）にはラベルを出さない
  const role = normalizeRole(user.role);
  const features = role === "CUSTOMER" ? [] : await allowedFeatures(role);
  return NextResponse.json({
    user: { ...user, role, roleLabel: ROLE_LABEL[role] || null, features, canAccessAdmin: canAccessAdmin(role) },
  });
}
