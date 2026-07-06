import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/cast-ranks/bulk
// body: { ranks: { name, backRate, order? }[] }
// 全件削除 → 再作成
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: { name: string; backRate: number; order?: number }[] = body.ranks ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "ranks は必須です" }, { status: 400 });

  await prisma.$transaction([
    prisma.castRank.deleteMany(),
    ...rows.map((r, i) =>
      prisma.castRank.create({
        data: { name: r.name, backRate: Number(r.backRate), order: r.order ?? i },
      })
    ),
  ]);

  const ranks = await prisma.castRank.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ranks });
}
