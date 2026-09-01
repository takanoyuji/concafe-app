import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalary, halfPeriodRange, CsvFormatError, type CastInput } from "@/lib/salary";
import { fetchRemodriSalesByCast, attributeByPrimaryStore, isRemodriConfigured, RemodriError, type RemodriCastSales } from "@/lib/remodri";
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
  // 期間は remodri の取得に必ず使う。DBに保存するかどうかは save で明示的に受け取る
  const save     = formData.get("save") === "1";

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
    prisma.cast.findMany({
      where: { retired: false },
      // 遠隔売上は所属店舗（主たる店舗）に計上するので一緒に引く
      include: { stores: { where: { isPrimary: true }, take: 1, include: { store: { select: { slug: true } } } } },
    }),
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

  // --- remodri（遠隔ドリンク会計）の取り込み ---
  // 2026-08-16 に遠隔売上の記録先がエアレジから remodri へ移った。取り込まないと
  // それ以降の業績・バックから遠隔分がまるごと抜ける。移行前の期間は0件が返る。
  let remodriRows: RemodriCastSales[] = [];
  let remodriOrphans: RemodriCastSales[] = [];
  if (isRemodriConfigured()) {
    if (!year || !month) {
      return NextResponse.json(
        { error: "remodri と連携しているため、年・月の指定が必要です" },
        { status: 400 }
      );
    }
    const { from, to } = halfPeriodRange(year, month, half ?? 0);
    try {
      // 伝票の店舗ではなくキャストの所属店舗に寄せるため、全店まとめて取得して振り分ける
      const all = await fetchRemodriSalesByCast(from, to);
      const primaryByCode = new Map(
        masters
          .map(m => [m.castCode, m.stores[0]?.store.slug] as const)
          .filter((e): e is readonly [string, string] => Boolean(e[1]))
      );
      const attributed = attributeByPrimaryStore(all, primaryByCode, prefix);
      remodriRows = attributed.mine;
      remodriOrphans = attributed.orphans;
    } catch (e) {
      // 取り込めないまま計算すると遠隔売上が抜けた給与が出るので、静かに続行しない
      if (e instanceof RemodriError) {
        return NextResponse.json(
          { error: `遠隔売上（remodri）を取り込めませんでした: ${e.message}` },
          { status: 502 }
        );
      }
      throw e;
    }
  }

  // 遠隔のみのキャスト（その店舗のエアレジ名が無い人）も対象に含める
  const hasRemodri = new Set(remodriRows.map(r => r.castCode));
  const casts: CastInput[] = masters
    .filter(m => m[regiField] || m[shiftField] || hasRemodri.has(m.castCode))
    .map(m => {
      const effectiveRank = monthlyRankMap?.get(m.id) ?? m.rank;
      return {
        castCode:              m.castCode,
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

  // CSVの形式が想定と違うときは計算せずに止める（0のまま保存させない）
  let summary;
  try {
    summary = calculateSalary(salesBuf, wageBuf, casts, remodriRows);
  } catch (e) {
    if (e instanceof CsvFormatError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // --- DB 保管（保存が指示されたときだけ）---
  if (save && year && month && half) {
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
    return NextResponse.json({ summary, periodId: period.id, remodriOrphans });
  }

  return NextResponse.json({ summary, remodriOrphans });
}
