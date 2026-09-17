import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/cast-ranks/bulk
// body: { ranks: { name, backRate, order?, hourlyWage?, commutePaid? }[] }
// 時給・交通費が無い行は、同名ランクの現在値を引き継ぐ（バック率だけのCSVで消さない）
// 全件削除 → 再作成
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: { name: string; backRate: number; order?: number; hourlyWage?: number; commutePaid?: boolean }[] = body.ranks ?? [];
  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "ranks は必須です" }, { status: 400 });

  const current = new Map((await prisma.castRank.findMany()).map(r => [r.name, r] as const));
  await prisma.$transaction([
    prisma.castRank.deleteMany(),
    ...rows.map((r, i) =>
      prisma.castRank.create({
        data: {
          name: r.name, backRate: Number(r.backRate), order: r.order ?? i,
          hourlyWage: r.hourlyWage != null ? Math.max(0, Math.round(Number(r.hourlyWage))) : (current.get(r.name)?.hourlyWage ?? 0),
          commutePaid: r.commutePaid != null ? Boolean(r.commutePaid) : (current.get(r.name)?.commutePaid ?? true),
        },
      })
    ),
  ]);

  const ranks = await prisma.castRank.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ranks });
}
