import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/salary/history
// 保存済みの給与期間一覧を返す
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const periods = await prisma.salaryPeriod.findMany({
    include: { summaryRecord: true },
    orderBy: [{ year: "desc" }, { month: "desc" }, { half: "desc" }],
  });
  return NextResponse.json({ periods });
}

// DELETE /api/admin/salary/history?id=xxx
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id は必須です" }, { status: 400 });

  await prisma.salaryPeriod.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
