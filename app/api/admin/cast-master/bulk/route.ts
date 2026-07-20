import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/cast-master/bulk
// body: { masters: { hpName, rank, tokyoAirRegi, tokyoAirShift, osakaAirRegi, osakaAirShift, nagoyaAirRegi, nagoyaAirShift }[] }
// 全件削除 → 再作成
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const rows: {
    hpName?: string; rank?: string;
    tokyoAirRegi?: string; tokyoAirShift?: string;
    osakaAirRegi?: string; osakaAirShift?: string;
    nagoyaAirRegi?: string; nagoyaAirShift?: string;
  }[] = body.masters ?? [];

  if (!Array.isArray(rows) || rows.length === 0)
    return NextResponse.json({ error: "masters は必須です" }, { status: 400 });

  await prisma.$transaction([
    prisma.castMaster.deleteMany(),
    ...rows.map(r =>
      prisma.castMaster.create({
        data: {
          hpName:        r.hpName        ?? "",
          rank:          r.rank          ?? "",
          tokyoAirRegi:  r.tokyoAirRegi  ?? "",
          tokyoAirShift: r.tokyoAirShift ?? "",
          osakaAirRegi:  r.osakaAirRegi  ?? "",
          osakaAirShift: r.osakaAirShift ?? "",
          nagoyaAirRegi: r.nagoyaAirRegi ?? "",
          nagoyaAirShift:r.nagoyaAirShift?? "",
        },
      })
    ),
  ]);

  const masters = await prisma.castMaster.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ masters });
}
