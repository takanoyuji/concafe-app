import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { clearPortalCache } from "@/lib/castPortal";

/**
 * POST   /api/admin/salary/history/[id]/finalize   — 確定（以後、計算実行＋保存で上書きできない）
 * DELETE /api/admin/salary/history/[id]/finalize   — 確定を解除
 * どちらも SalaryPeriodLog に残す（docs/cast-portal-requirements.md 5章）
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return toggle(await params, "finalize");
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return toggle(await params, "unfinalize");
}

async function toggle({ id }: { id: string }, action: "finalize" | "unfinalize") {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const period = await prisma.salaryPeriod.findUnique({ where: { id }, select: { id: true, finalizedAt: true } });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (action === "finalize" && period.finalizedAt) return NextResponse.json({ error: "既に確定しています" }, { status: 409 });
  if (action === "unfinalize" && !period.finalizedAt) return NextResponse.json({ error: "確定していません" }, { status: 409 });

  const updated = await prisma.$transaction(async tx => {
    const p = await tx.salaryPeriod.update({
      where: { id },
      data: action === "finalize"
        ? { finalizedAt: new Date(), finalizedByUserId: session.userId }
        : { finalizedAt: null, finalizedByUserId: null },
    });
    await tx.salaryPeriodLog.create({ data: { periodId: id, action, userId: session.userId } });
    return p;
  });
  clearPortalCache();
  return NextResponse.json({ period: { id: updated.id, finalizedAt: updated.finalizedAt } });
}
