import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { checkMinimumWage, type MinWageInput, type MinWageStoreCode } from "@/lib/minWage";

function storePrefix(storeName: string): MinWageStoreCode | null {
  if (storeName.includes("池袋") || storeName === "東京") return "tokyo";
  if (storeName.includes("日本橋") || storeName === "大阪") return "osaka";
  if (storeName.includes("名古屋")) return "nagoya";
  return null;
}

// GET /api/admin/salary/history/[id] - 期間詳細（キャスト一覧付き）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const { id } = await params;
  const period = await prisma.salaryPeriod.findUnique({
    where: { id },
    include: { castRecords: true, summaryRecord: true },
  });
  if (!period) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 最低賃金の判定（月間トータル）。保存済みを読み直すときも同じ基準で出す
  const prefix = storePrefix(period.storeName);
  let minWage = null;
  if (prefix) {
    // 時給0のランク（内勤）は判定の対象外（計算APIと同じ扱い）
    const zeroWageRanks = new Set((await prisma.castRank.findMany({ where: { hourlyWage: 0 } })).map(r => r.name));
    const toInput = (rs: typeof period.castRecords): MinWageInput[] =>
      rs.filter(r => !zeroWageRanks.has(r.rank))
        .map(r => ({ castName: r.castName, salary: r.salary || r.payment, commute: r.commute, workMinutes: r.workMinutes }));
    let other: MinWageInput[] | null = null;
    if (period.half === 1 || period.half === 2) {
      const otherPeriod = await prisma.salaryPeriod.findUnique({
        where: { storeName_year_month_half: { storeName: period.storeName, year: period.year, month: period.month, half: period.half === 1 ? 2 : 1 } },
        include: { castRecords: true },
      });
      if (otherPeriod && otherPeriod.castRecords.some(r => r.workMinutes > 0)) other = toInput(otherPeriod.castRecords);
    }
    // 今回の期間に労働時間の記録が無い（旧レコード）なら判定しない
    minWage = period.castRecords.some(r => r.workMinutes > 0)
      ? checkMinimumWage(prefix, period.year, period.month, period.half, toInput(period.castRecords), other)
      : null;
  }
  return NextResponse.json({ period, minWage });
}
