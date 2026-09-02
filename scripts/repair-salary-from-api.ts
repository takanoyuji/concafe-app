/**
 * 保存済みの給与期間を、Airレジ API の取引明細から計算し直して上書きする。
 *
 * 用途は「エアレジ側だけ壊れている期間の復旧」。
 * 2026-08-16 に、名古屋の売上CSVと人件費CSVで東京の給与計算が保存され、
 * 東京の業績が名古屋の数字に、キャスト17人が全員0円になった事故があった。
 *
 * ⚠️ 人件費（基本給・通勤手当・労働時間）は復旧できない。
 * エアシフトの人件費CSVにしか無く、APIからは取れないため。
 * このスクリプトが直すのは売上・粗利・バック・業績サマリまでで、
 * 人件費は0のまま残る。**あとで管理画面から人件費CSVを入れて計算し直すこと。**
 *
 *   docker cp scripts/repair-salary-from-api.ts concafe-app-app-1:/app/scripts/
 *   docker exec concafe-app-app-1 npx tsx scripts/repair-salary-from-api.ts 東京 2026 8 1
 *   docker exec concafe-app-app-1 npx tsx scripts/repair-salary-from-api.ts 東京 2026 8 1 --apply
 *
 * --apply を付けるまで書き込まない。
 */
// アプリ共通のクライアントを使う。new PrismaClient() は接続設定を要求するため
import { prisma } from "../lib/prisma";
import { buildSalesInput, assertPeriodComplete } from "../lib/airregiSales";
import { calculateSalaryFromRows, halfPeriodRange, type CastInput } from "../lib/salary";
import { getRanksForPeriod } from "../lib/rank";

function storePrefix(storeName: string): "tokyo" | "osaka" | "nagoya" | null {
  if (storeName.includes("池袋") || storeName === "東京") return "tokyo";
  if (storeName.includes("日本橋") || storeName === "大阪") return "osaka";
  if (storeName.includes("名古屋")) return "nagoya";
  return null;
}

// 人件費CSVが無いので、列の検証だけ通る空の内容を渡す。
// 氏名がどのキャストにも一致しないため、基本給・通勤手当は誰にも付かない
const EMPTY_WAGE = new TextEncoder().encode(
  "氏名,基本給,通勤手当,労働時間\r\n（人件費CSV未取込）,0,0,0:00"
).buffer as ArrayBuffer;

async function main() {
  const [storeName, yearStr, monthStr, halfStr] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  if (!storeName || !yearStr || !monthStr || !halfStr) {
    console.error("使い方: repair-salary-from-api.ts <店舗> <年> <月> <半期 0|1|2> [--apply]");
    process.exit(2);
  }
  const year = Number(yearStr), month = Number(monthStr), half = Number(halfStr);
  const prefix = storePrefix(storeName);
  if (!prefix) throw new Error(`店舗「${storeName}」を認識できません`);

  const { from, to } = halfPeriodRange(year, month, half);
  const fromYmd = from.replace(/-/g, ""), toYmd = to.replace(/-/g, "");
  console.log(`対象: ${storeName} ${year}/${month} 半期${half}  (${fromYmd}〜${toYmd})`);

  // 取り込み漏れがある期間は直さない。欠けたまま上書きすると別の壊れ方をする
  await assertPeriodComplete(prefix, fromYmd, toYmd);

  const [masters, castRanks, monthlyRankMap] = await Promise.all([
    prisma.cast.findMany({ where: { retired: false } }),
    prisma.castRank.findMany(),
    getRanksForPeriod(year, month),
  ]);
  const rankMap = new Map(castRanks.map(r => [r.name, r.backRate] as const));
  const regiField = `${prefix}AirRegi` as keyof (typeof masters)[0];
  const shiftField = `${prefix}AirShift` as keyof (typeof masters)[0];

  const casts: CastInput[] = masters
    .filter(m => m[regiField] || m[shiftField])
    .map(m => {
      const rank = monthlyRankMap?.get(m.id) ?? m.rank;
      return {
        castCode: m.castCode,
        castName: String(m[regiField] || ""),
        airShiftName: String(m[shiftField] || ""),
        rank,
        backRate: rankMap.get(rank) ?? 0,
        exemptFromCommuteRule: false,
      };
    })
    .filter(c => c.castName || c.airShiftName);

  const { rows, orderDiscount } = await buildSalesInput(prefix, fromYmd, toYmd);
  // remodri は渡さない。遠隔売上は管理画面から計算し直すときに入る
  const s = calculateSalaryFromRows(rows, EMPTY_WAGE, casts, [], { orderDiscount });

  const before = await prisma.salaryPeriod.findUnique({
    where: { storeName_year_month_half: { storeName, year, month, half } },
    include: { summaryRecord: true },
  });

  console.log("\n              いま        直したあと");
  const line = (label: string, a: number | undefined, b: number) =>
    console.log(`  ${label.padEnd(10)} ${String(Math.round(a ?? 0)).padStart(10)} ${String(Math.round(b)).padStart(12)}`);
  line("売上(税込)", before?.summaryRecord?.totalSalesTaxIncl, s.totalSalesTaxIncl);
  line("粗利", before?.summaryRecord?.grossProfit, s.grossProfit);
  line("キャスト給与", before?.summaryRecord?.castPay, s.castPay);
  line("貢献利益", before?.summaryRecord?.contributionProfit, s.contributionProfit);
  console.log(`  全体割引 ${orderDiscount}  / 明細 ${rows.length}行 / キャスト ${s.casts.length}人`);
  console.log(`  労働時間 ${before?.summaryRecord?.workHours ?? "-"} → ${s.workHours}（人件費CSV未取込のため0のまま）`);

  if (!apply) {
    console.log("\n--apply を付けていないので書き込みません。");
    return;
  }

  const hpNameMap = new Map(masters.map(m => [String(m[regiField] || ""), m.name] as const));
  await prisma.$transaction(async tx => {
    if (before) await tx.salaryPeriod.delete({ where: { id: before.id } });
    await tx.salaryPeriod.create({
      data: {
        storeName, year, month, half,
        castRecords: {
          create: s.casts.map(c => ({
            castName: c.castName,
            hpName: hpNameMap.get(c.castName) ?? "",
            rank: c.rank,
            basicPay: c.basicPay,
            commute: c.commute,
            back: c.back,
            payment: c.payment,
            grossProfit: c.grossProfit,
            totalSales: c.totalSales,
          })),
        },
        summaryRecord: {
          create: {
            totalSalesTaxIncl: s.totalSalesTaxIncl,
            remoteSales: s.remoteSales,
            localSales: s.localSales,
            taxAmount: s.taxAmount,
            grossProfit: s.grossProfit,
            purchases: s.purchases,
            castPay: s.castPay,
            laborCost: s.laborCost,
            contributionProfit: s.contributionProfit,
            workHours: s.workHours,
            orderDiscount: s.orderDiscount,
          },
        },
      },
    });
  });
  console.log("\n書き込みました。⚠️ 人件費CSVが手に入ったら、管理画面から計算し直すこと。");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
