/**
 * API の認可。機能ごとに「そのロールで使えるか」を判定する（lib/permissions.ts の表）。
 * lib/auth.ts と分けているのは、auth.ts が proxy.ts（エッジ）からも読まれ、prisma を持ち込めないため。
 *
 *   const auth = await requireFeature("salary");
 *   if (auth instanceof Response) return auth;
 */
import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth";
import { can, type Feature } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/** 停止されたアカウント（disabledAt）か。JWT は残っているので、機能を使う入口で毎回見る。
 *  ユーザーが見つからない場合は停止扱いにしない（削除できるのは未ログインの人だけで、生きたセッションが無いため） */
export async function isDisabledUser(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  return Boolean(u?.disabledAt);
}

export async function requireFeature(feature: Feature): Promise<SessionPayload | Response> {
  const session = await getSession();
  if (!session || !(await can(session.role, feature)) || (await isDisabledUser(session.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
