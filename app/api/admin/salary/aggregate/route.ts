import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalary, CsvFormatError, type CastInput } from "@/lib/salary";

export interface AggregateResult {
  masterId:    string;
  name:      string;
  rank:        string;
  tokyo:       number;  // 東京 payment (0 if no data)
  osaka:       number;  // 大阪 payment
  nagoya:      number;  // 名古屋 payment
  total:       number;
}

// CastMasterフィールドからstoreごとのCastInputを作成
function buildCasts(
  masters: Awaited<ReturnType<typeof prisma.cast.findMany>>,
  rankMap: Map<string, number>,
  prefix: "tokyo" | "osaka" | "nagoya"
): CastInput[] {
  const regiField  = `${prefix}AirRegi`  as keyof typeof masters[0];
  const shiftField = `${prefix}AirShift` as keyof typeof masters[0];
  return masters
    .filter(m => m[regiField] || m[shiftField])
    .map(m => ({
      castCode:              m.castCode,
      castName:              String(m[regiField]  || ""),
      airShiftName:          String(m[shiftField] || ""),
      rank:                  m.rank,
      backRate:              rankMap.get(m.rank) ?? 0,
      exemptFromCommuteRule: false,
    }))
    .filter(c => c.castName || c.airShiftName);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const tokyoSales  = formData.get("tokyoSalesCsv")  as File | null;
  const tokyoWage   = formData.get("tokyoWageCsv")   as File | null;
  const osakaSales  = formData.get("osakaSalesCsv")  as File | null;
  const osakaWage   = formData.get("osakaWageCsv")   as File | null;
  const nagoyaSales = formData.get("nagoyaSalesCsv") as File | null;
  const nagoyaWage  = formData.get("nagoyaWageCsv")  as File | null;

  const [masters, castRanks] = await Promise.all([
    prisma.cast.findMany({ where: { retired: false }, orderBy: { createdAt: "asc" } }),
    prisma.castRank.findMany(),
  ]);

  const rankMap = new Map<string, number>(castRanks.map(r => [r.name, r.backRate] as [string, number]));

  // 各店舗の支払額マップ（エアレジ名 → payment）
  const paymentMap: Record<string, Map<string, number>> = {
    tokyo: new Map(), osaka: new Map(), nagoya: new Map(),
  };

  const inputs = [
    { prefix: "tokyo",  label: "東京",   sales: tokyoSales,  wage: tokyoWage  },
    { prefix: "osaka",  label: "大阪",   sales: osakaSales,  wage: osakaWage  },
    { prefix: "nagoya", label: "名古屋", sales: nagoyaSales, wage: nagoyaWage },
  ] as const;

  for (const { prefix, label, sales, wage } of inputs) {
    if (!sales || !wage) continue;
    const casts = buildCasts(masters, rankMap, prefix);
    try {
      const summary = calculateSalary(await sales.arrayBuffer(), await wage.arrayBuffer(), casts);
      for (const c of summary.casts) paymentMap[prefix].set(c.castName, c.payment);
    } catch (e) {
      // 1店舗でも読めなければ、途中までの集計を返さずに止める
      if (e instanceof CsvFormatError) {
        return NextResponse.json({ error: `${label}店: ${e.message}` }, { status: 400 });
      }
      throw e;
    }
  }

  const results: AggregateResult[] = masters.map(m => {
    const tokyo  = paymentMap.tokyo.get(m.tokyoAirRegi)   ?? 0;
    const osaka  = paymentMap.osaka.get(m.osakaAirRegi)   ?? 0;
    const nagoya = paymentMap.nagoya.get(m.nagoyaAirRegi) ?? 0;
    const total  = tokyo + osaka + nagoya;
    // 全店舗で何も出勤がなければスキップ
    return { masterId: m.id, name: m.name, rank: m.rank, tokyo, osaka, nagoya, total };
  }).filter(r => r.total > 0);

  // 合計でソート
  results.sort((a, b) => b.total - a.total);

  return NextResponse.json({ results });
}
