import { NextResponse } from "next/server";
import { isMisekinConfigured } from "@/lib/misekin";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/admin/salary/history
// 保存済みの給与期間一覧を返す
export async function GET() {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const periods = await prisma.salaryPeriod.findMany({
    include: { summaryRecord: true },
    orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
  });
  // 人件費を みせ勤 から取れる設定になっているか。画面はこれを見て選択肢を出す
  return NextResponse.json({ periods, misekinConfigured: isMisekinConfigured() });
}

// DELETE /api/admin/salary/history?id=xxx
export async function DELETE(req: Request) {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

  // 確定済みは消せない（キャストに見せた「確定」を消さない）。解除してから
  const period = await prisma.salaryPeriod.findUnique({ where: { id }, select: { finalizedAt: true } });
  if (period?.finalizedAt) return NextResponse.json({ error: "確定済みの期間は削除できません。先に確定を解除してください" }, { status: 409 });

  await prisma.salaryPeriod.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
