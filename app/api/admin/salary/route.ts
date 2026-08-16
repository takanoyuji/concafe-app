import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalary, type CastInput } from "@/lib/salary";
import { getRanksForPeriod } from "@/lib/rank";

function storePrefix(storeName: string): "tokyo" | "osaka" | "nagoya" | null {
  if (storeName.includes("池袋") || storeName === "東京") return "tokyo";
  if (storeName.includes("日本橋") || storeName === "大阪") return "osaka";
  if (storeName.includes("名古屋")) return "nagoya";
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const store    = formData.get("store")    as string | null;
  const salesFile = formData.get("salesCsv") as File | null;
  const wageFile  = formData.get("wageCsv")  as File | null;
  // 期間パラメータ（任意）
  const yearStr  = formData.get("year")  as string | null;
  const monthStr = formData.get("month") as string | null;
  const halfStr  = formData.get("half")  as string | null;

  if (!store || !salesFile || !wageFile) {
    return NextResponse.json({ error: "store, salesCsv, wageCsv は必須です" }, { status: 400 });
  }

  const prefix = storePrefix(store);
  if (!prefix) {
    return NextResponse.json({ error: `店舗「${store}」を認識できません` }, { status: 400 });
  }

  // 期間パラメータを先に解析（月別ランク取得に使う）
  const year  = yearStr  ? parseInt(yearStr,  10) : null;
  const month = monthStr ? parseInt(monthStr, 10) : null;
  const half  = halfStr  ? parseInt(halfStr,  10) : null;

  const [masters, castRanks, monthlyRankMap] = await Promise.all([
    prisma.cast.findMany({ where: { retired: false } }),
    prisma.castRank.findMany(),
    year && month ? getRanksForPeriod(year, month) : Promise.resolve(null),
  ]);

  const rankMap = new Map<string, number>(castRanks.map(r => [r.name, r.backRate] as [string, number]));
  const hpNameMap = new Map<string, string>(masters.map(m => {
    const regi = String(m[`${prefix}AirRegi` as keyof typeof m] || "");
    return [regi, m.name] as [string, string];
  }));

  const regiField  = `${prefix}AirRegi`  as keyof typeof masters[0];
  const shiftField = `${prefix}AirShift` as keyof typeof masters[0];

  const casts: CastInput[] = masters
    .filter(m => m[regiField] || m[shiftField])
    .map(m => {
      const effectiveRank = monthlyRankMap?.get(m.id) ?? m.rank;
      return {
        castName:              String(m[regiField]  || ""),
        airShiftName:          String(m[shiftField] || ""),
        rank:                  effectiveRank,
        backRate:              rankMap.get(effectiveRank) ?? 0,
        exemptFromCommuteRule: false,
      };
    })
    .filter(c => c.castName || c.airShiftName);

  const salesBuf = await salesFile.arrayBuffer();
  const wageBuf  = await wageFile.arrayBuffer();

  const summary = calculateSalary(salesBuf, wageBuf, casts);

  // --- DB 保管（期間指定があれば）---
  if (year && month && half) {
    // 同じ期間があれば削除→再作成（upsert相当）
    const existing = await prisma.salaryPeriod.findUnique({
      where: { storeName_year_month_half: { storeName: store, year, month, half } },
    });
    if (existing) {
      await prisma.salaryPeriod.delete({ where: { id: existing.id } });
    }

    const period = await prisma.salaryPeriod.create({
      data: {
        storeName: store, year, month, half,
        castRecords: {
          create: summary.casts.map(c => ({
            castName:    c.castName,
            hpName:      hpNameMap.get(c.castName) ?? "",
            rank:        c.rank,
            basicPay:    c.basicPay,
            commute:     c.commute,
            back:        c.back,
            payment:     c.payment,
            grossProfit: c.grossProfit,
            totalSales:  c.totalSales,
          })),
        },
        summaryRecord: {
          create: {
            totalSalesTaxIncl:  summary.totalSalesTaxIncl,
            remoteSales:        summary.remoteSales,
            localSales:         summary.localSales,
            taxAmount:          summary.taxAmount,
            grossProfit:        summary.grossProfit,
            purchases:          summary.purchases,
            castPay:            summary.castPay,
            laborCost:          summary.laborCost,
            contributionProfit: summary.contributionProfit,
            workHours:          summary.workHours,
          },
        },
      },
    });
    return NextResponse.json({ summary, periodId: period.id });
  }

  return NextResponse.json({ summary });
}
