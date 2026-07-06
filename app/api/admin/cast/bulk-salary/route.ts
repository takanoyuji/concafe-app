import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/cast/bulk-salary
// body: { rows: { name, airShiftName, rank }[] }
// キャスト名で検索してairShiftName/rankを更新
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: { name: string; airShiftName?: string; rank?: string }[] = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "rows は必須です" }, { status: 400 });

  let updated = 0;
  for (const row of rows) {
    if (!row.name) continue;
    const result = await prisma.cast.updateMany({
      where: { name: row.name },
      data: {
        ...(row.airShiftName != null && { airShiftName: row.airShiftName }),
        ...(row.rank != null && { rank: row.rank }),
      },
    });
    updated += result.count;
  }

  return NextResponse.json({ updated });
}
