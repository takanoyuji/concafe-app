import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { normalizeRole } from "@/lib/permissions";
import { inviteStaff, InviteError } from "@/lib/staffInvite";

/**
 * POST /api/admin/cast-master/[id]/invite  { email, emailConfirm, role? }
 *
 * キャストマスタの人を招待する（初期パスワード方式。lib/staffInvite.ts）。
 * 応答の initialPassword は**この1回しか出ない**。画面はそれを店長に見せ、本人へ別経路で渡してもらう。
 * role は CAST（既定）か MANAGER。**MANAGER として招待できるのは OWNER だけ**
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("cast");
  if (session instanceof Response) return session;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role: "CAST" | "MANAGER" = body.role === "MANAGER" ? "MANAGER" : "CAST";
  if (role === "MANAGER" && normalizeRole(session.role) !== "OWNER") {
    return NextResponse.json({ error: "店長として招待できるのはオーナーだけです" }, { status: 403 });
  }
  try {
    const r = await inviteStaff({
      email: String(body.email ?? ""), emailConfirm: String(body.emailConfirm ?? ""),
      role, castId: id, invitedByUserId: session.userId,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof InviteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
