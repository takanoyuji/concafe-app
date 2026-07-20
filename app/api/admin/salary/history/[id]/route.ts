import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/salary/history/[id] - 期間詳細（キャスト一覧付き）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const period = await prisma.salaryPeriod.findUnique({
    where: { id },
    include: { castRecords: true, summaryRecord: true },
  });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ period });
}
