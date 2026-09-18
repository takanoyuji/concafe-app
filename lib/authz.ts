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

export async function requireFeature(feature: Feature): Promise<SessionPayload | Response> {
  const session = await getSession();
  if (!session || !(await can(session.role, feature))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
