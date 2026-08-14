import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRanksForPeriod } from "@/lib/rank";

function storePrefix(storeName: string): "tokyo" | "osaka" | "nagoya" | null {
  if (storeName.includes("池袋") || storeName === "東京") return "tokyo";
  if (storeName.includes("日本橋") || storeName === "大阪") return "osaka";
  if (storeName.includes("名古屋")) return "nagoya";
  return null;
}

function halfLabel(half: number) {
  return half === 0 ? "全体" : half === 1 ? "前半" : "後半";
}

export interface AggDbResult {
  masterId: string;
  name: string;
  rank: string;
  tokyo: number;
  osaka: number;
  nagoya: number;
  total: number;
}

export interface StoreReport {
  storeName: string;
  halves: string[];
  totalSalesTaxIncl: number;
  remoteSales: number;
  localSales: number;
  taxAmount: number;
  grossProfit: number;
  purchases: number;
  castPay: number;
  laborCost: number;
  contributionProfit: number;
}

// GET /api/admin/salary/aggregate-db?year=YYYY&month=MM
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month)
    return NextResponse.json({ error: "year, month は必須です" }, { status: 400 });

  const [periods, masters, monthlyRankMap] = await Promise.all([
    prisma.salaryPeriod.findMany({
      where: { year, month },
      include: { castRecords: true, summaryRecord: true },
      orderBy: [{ storeName: "asc" }, { half: "asc" }],
    }),
    prisma.cast.findMany({ where: { retired: false } }),
    getRanksForPeriod(year, month),
  ]);

  if (periods.length === 0)
    return NextResponse.json({ results: [], storeReports: [] });

  // Cast aggregate per masterId
  const resultMap = new Map<string, { name: string; rank: string; tokyo: number; osaka: number; nagoya: number }>();
  for (const m of masters) {
    const effectiveRank = monthlyRankMap.get(m.id) ?? m.rank;
    resultMap.set(m.id, { name: m.name, rank: effectiveRank, tokyo: 0, osaka: 0, nagoya: 0 });
  }

  for (const period of periods) {
    const prefix = storePrefix(period.storeName);
    if (!prefix) continue;
    const regiField = `${prefix}AirRegi` as keyof typeof masters[0];

    for (const record of period.castRecords) {
      const master = masters.find(m => String(m[regiField]) === record.castName);
      if (!master) continue;
      const r = resultMap.get(master.id);
      if (!r) continue;
      r[prefix] += record.payment;
    }
  }

  const results: AggDbResult[] = [...resultMap.entries()]
    .map(([masterId, r]) => ({
      masterId,
      name: r.name,
      rank: r.rank,
      tokyo: r.tokyo,
      osaka: r.osaka,
      nagoya: r.nagoya,
      total: r.tokyo + r.osaka + r.nagoya,
    }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  // P&L per store (sum all halves)
  const storeReportMap = new Map<string, StoreReport>();
  for (const period of periods) {
    if (!period.summaryRecord) continue;
    const s = period.summaryRecord;
    if (!storeReportMap.has(period.storeName)) {
      storeReportMap.set(period.storeName, {
        storeName: period.storeName,
        halves: [],
        totalSalesTaxIncl: 0,
        remoteSales: 0,
        localSales: 0,
        taxAmount: 0,
        grossProfit: 0,
        purchases: 0,
        castPay: 0,
        laborCost: 0,
        contributionProfit: 0,
      });
    }
    const report = storeReportMap.get(period.storeName)!;
    report.halves.push(halfLabel(period.half));
    report.totalSalesTaxIncl += s.totalSalesTaxIncl;
    report.remoteSales += s.remoteSales;
    report.localSales += s.localSales;
    report.taxAmount += s.taxAmount;
    report.grossProfit += s.grossProfit;
    report.purchases += s.purchases;
    report.castPay += s.castPay;
    report.laborCost += s.laborCost;
    report.contributionProfit += s.contributionProfit;
  }

  const storeReports = [...storeReportMap.values()];

  return NextResponse.json({ results, storeReports });
}
