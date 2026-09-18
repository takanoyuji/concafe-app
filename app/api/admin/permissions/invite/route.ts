import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { inviteStaff, InviteError } from "@/lib/staffInvite";

/**
 * POST /api/admin/permissions/invite  { email, emailConfirm }
 * キャストマスタに無い店長を招待する（OWNER だけ）。初期パスワード方式。応答の initialPassword は1回しか出ない
 */
export async function POST(req: Request) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const body = await req.json().catch(() => ({}));
  try {
    const r = await inviteStaff({
      email: String(body.email ?? ""), emailConfirm: String(body.emailConfirm ?? ""),
      role: "MANAGER", castId: null, invitedByUserId: session.userId,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof InviteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
