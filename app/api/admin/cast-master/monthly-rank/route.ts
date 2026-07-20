import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRanksForPeriod } from "@/lib/rank";

// GET /api/admin/cast-master/monthly-rank?year=YYYY&month=MM
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month)
    return NextResponse.json({ error: "year, month は必須です" }, { status: 400 });

  const rankMap = await getRanksForPeriod(year, month);
  const ranks = Object.fromEntries(rankMap);

  return NextResponse.json({ year, month, ranks });
}

// POST /api/admin/cast-master/monthly-rank
// Body: { year, month, ranks: { castMasterId: string, rank: string }[] }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { year, month, ranks } = body as {
    year: number;
    month: number;
    ranks: { castMasterId: string; rank: string }[];
  };

  if (!year || !month || !Array.isArray(ranks))
    return NextResponse.json({ error: "year, month, ranks は必須です" }, { status: 400 });

  // 各エントリを upsert
  const results = await Promise.all(
    ranks.map((r) =>
      prisma.castMonthlyRank.upsert({
        where: {
          castMasterId_year_month: {
            castMasterId: r.castMasterId,
            year,
            month,
          },
        },
        update: { rank: r.rank },
        create: {
          castMasterId: r.castMasterId,
          year,
          month,
          rank: r.rank,
        },
      })
    )
  );

  // CastMaster.rank も最新値に更新
  await Promise.all(
    ranks.map((r) =>
      prisma.castMaster.update({
        where: { id: r.castMasterId },
        data: { rank: r.rank },
      })
    )
  );

  return NextResponse.json({ count: results.length });
}
