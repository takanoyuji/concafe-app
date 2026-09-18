import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getRanksForPeriod } from "@/lib/rank";

// GET /api/admin/cast-master/monthly-rank?year=YYYY&month=MM
export async function GET(req: Request) {
  const session = await requireFeature("cast");
  if (session instanceof Response) return session;

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
// Body: { year, month, ranks: { castId: string, rank: string }[] }
export async function POST(req: Request) {
  const session = await requireFeature("cast");
  if (session instanceof Response) return session;

  const body = await req.json();
  const { year, month, ranks } = body as {
    year: number;
    month: number;
    ranks: { castId: string; rank: string }[];
  };

  if (!year || !month || !Array.isArray(ranks))
    return NextResponse.json({ error: "year, month, ranks は必須です" }, { status: 400 });

  // 各エントリを upsert
  const results = await Promise.all(
    ranks.map((r) =>
      prisma.castMonthlyRank.upsert({
        where: {
          castId_year_month: {
            castId: r.castId,
            year,
            month,
          },
        },
        update: { rank: r.rank },
        create: {
          castId: r.castId,
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
      prisma.cast.update({
        where: { id: r.castId },
        data: { rank: r.rank },
      })
    )
  );

  return NextResponse.json({ count: results.length });
}
