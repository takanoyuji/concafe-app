import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/permissions";
import { reissueInitialPassword, InviteError } from "@/lib/staffInvite";

/**
 * PATCH /api/admin/permissions/staff/[id]  { action }
 *   reissue … 初期パスワードを作り直す（未ログインの人だけ）。応答の initialPassword は1回しか出ない
 *   disable / enable … 停止 / 再開（セッションが残っていても機能は 403 になる）
 *   unlink … キャストマスタから切り離す（Cast.userId を外す）。報酬が見えなくなる
 * DELETE /api/admin/permissions/staff/[id] … 未ログインのアカウントを削除（間違って招待したとき）
 * どれも OWNER だけ。OWNER 自身と客（CUSTOMER）には使えない
 */
async function target(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, lastLoginAt: true, disabledAt: true } });
  if (!u) return { error: NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 }) };
  const role = normalizeRole(u.role);
  if (role === "OWNER" || role === "CUSTOMER") return { error: NextResponse.json({ error: "この操作は店長・キャストのアカウントだけです" }, { status: 400 }) };
  return { user: u };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const t = await target(id);
  if ("error" in t) return t.error;

  try {
    switch (body.action) {
      case "reissue": {
        const r = await reissueInitialPassword(id);
        return NextResponse.json({ ok: true, ...r });
      }
      case "disable":
        await prisma.user.update({ where: { id }, data: { disabledAt: new Date() } });
        return NextResponse.json({ ok: true });
      case "enable":
        await prisma.user.update({ where: { id }, data: { disabledAt: null } });
        return NextResponse.json({ ok: true });
      case "unlink": {
        const r = await prisma.cast.updateMany({ where: { userId: id }, data: { userId: null } });
        return NextResponse.json({ ok: true, unlinked: r.count });
      }
      default:
        return NextResponse.json({ error: "action が正しくありません" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof InviteError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("permissions");
  if (session instanceof Response) return session;
  const { id } = await params;
  const t = await target(id);
  if ("error" in t) return t.error;
  if (t.user.lastLoginAt) {
    return NextResponse.json({ error: "ログイン済みのアカウントは削除できません。「停止」か「切り離す」を使ってください" }, { status: 409 });
  }
  await prisma.$transaction([
    prisma.cast.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
