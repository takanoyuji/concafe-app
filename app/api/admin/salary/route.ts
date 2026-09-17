import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalary, calculateSalaryFromRows, halfPeriodRange, CsvFormatError, type CastInput } from "@/lib/salary";
import { buildSalesInput, assertPeriodComplete, AirRegiPeriodError } from "@/lib/airregiSales";
import { fetchRemodriSalesByCast, attributeByPrimaryStore, isRemodriConfigured, RemodriError, type RemodriCastSales } from "@/lib/remodri";
import { fetchMisekinAttendance, buildWagesFromAttendance, isMisekinConfigured, MisekinError, type MisekinWages } from "@/lib/misekin";
import { getRanksForPeriod } from "@/lib/rank";
import { checkMinimumWage, type MinWageInput } from "@/lib/minWage";
import { clearPortalCache } from "@/lib/castPortal";

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
  // 売上の出どころ。既定は "api"（取り込み済みの取引明細から作る）。
  // "csv" はフォールバック。Airレジの取り込みが止まっているときや、
  // 62日より前の期間を計算し直すときに使う。
  // ⚠️ "api" のときは salesCsv が来ていても見ない。CSVを使いたいなら source を明示すること
  const source = (formData.get("source") as string | null) === "csv" ? "csv" : "api";
  // 人件費の出どころ。既定はエアシフトの人件費CSV。"misekin" は みせ勤 API から作る
  // （時給・交通費が みせ勤に登録されていることが前提。無ければ lib/misekin.ts が止める）
  const wageSource = (formData.get("wageSource") as string | null) === "misekin" ? "misekin" : "csv";
  // 期間パラメータ（任意）
  const yearStr  = formData.get("year")  as string | null;
  const monthStr = formData.get("month") as string | null;
  const halfStr  = formData.get("half")  as string | null;
  // 期間は remodri の取得に必ず使う。DBに保存するかどうかは save で明示的に受け取る
  const save     = formData.get("save") === "1";

  if (!store || (wageSource === "csv" && !wageFile)) {
    return NextResponse.json({ error: "store と wageCsv は必須です" }, { status: 400 });
  }
  if (wageSource === "misekin" && !isMisekinConfigured()) {
    return NextResponse.json({ error: "みせ勤と連携する設定（MISEKIN_API_URL / MISEKIN_API_KEY）がありません" }, { status: 400 });
  }
  if (source === "csv" && !salesFile) {
    return NextResponse.json({ error: "salesCsv は必須です" }, { status: 400 });
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
  // ランク制度表（時給・交通費○/×）。期間に効いているランクで引く
  const rankTerms = new Map(castRanks.map(r => [r.name, { hourlyWage: r.hourlyWage, commutePaid: r.commutePaid }] as const));
  const effectiveRankOf = (m: (typeof masters)[number]) => monthlyRankMap?.get(m.id) ?? m.rank;
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

  // --- みせ勤（勤怠）の取り込み ---
  // 人件費CSVの代わり。打刻ごとの 実労働分×ランクの時給 と、マスタの日額×出勤日数 をキャストコード別にまとめる
  let misekinWages: MisekinWages | null = null;
  if (wageSource === "misekin") {
    if (!year || !month) {
      return NextResponse.json({ error: "みせ勤から計算するには、年・月の指定が必要です" }, { status: 400 });
    }
    const { from, to } = halfPeriodRange(year, month, half ?? 0);
    try {
      const rows = await fetchMisekinAttendance(prefix, from, to);
      const terms = new Map(masters.map(m => {
        const rank = effectiveRankOf(m);
        return [m.castCode, { rank, hourlyWage: rankTerms.get(rank)?.hourlyWage ?? 0, commuteDaily: m.commuteDaily }] as const;
      }));
      misekinWages = buildWagesFromAttendance(rows, terms);
      if (misekinWages.count === 0) {
        return NextResponse.json(
          { error: `みせ勤に ${store} の ${from}〜${to} の勤怠がありません。期間と店舗を確認してください` },
          { status: 400 }
        );
      }
    } catch (e) {
      if (e instanceof MisekinError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  }

  // 遠隔のみのキャスト（その店舗のエアレジ名が無い人）も対象に含める。みせ勤に打刻がある人も同様
  const hasRemodri = new Set(remodriRows.map(r => r.castCode));
  const hasMisekin = new Set(misekinWages?.byCastCode.keys() ?? []);
  const casts: CastInput[] = masters
    .filter(m => m[regiField] || m[shiftField] || hasRemodri.has(m.castCode) || hasMisekin.has(m.castCode))
    .map(m => {
      const effectiveRank = effectiveRankOf(m);
      return {
        castCode:              m.castCode,
        castName:              String(m[regiField]  || ""),
        airShiftName:          String(m[shiftField] || ""),
        rank:                  effectiveRank,
        backRate:              rankMap.get(effectiveRank) ?? 0,
        exemptFromCommuteRule: false,
        // ランク表に無いランク名なら undefined → 計算側の従来リストで判定
        commutePaid:           rankTerms.get(effectiveRank)?.commutePaid,
      };
    })
    .filter(c => c.castName || c.airShiftName || hasMisekin.has(c.castCode));

  // 人件費の入力。CSV か みせ勤 のどちらか
  const wageBuf: ArrayBuffer | MisekinWages = misekinWages ?? (await wageFile!.arrayBuffer());

  // 形式や取り込みが想定と違うときは計算せずに止める（0のまま保存させない）
  let summary;
  try {
    if (source === "api") {
      if (!year || !month) {
        return NextResponse.json(
          { error: "Airレジ APIから計算するには、年・月の指定が必要です" },
          { status: 400 }
        );
      }
      const { from, to } = halfPeriodRange(year, month, half ?? 0);
      const fromYmd = from.replace(/-/g, "");
      const toYmd   = to.replace(/-/g, "");
      // 1日でも取り込み漏れがあると、その日の売上が丸ごと抜けた給与が出る。先に止める
      await assertPeriodComplete(prefix, fromYmd, toYmd);
      const { rows, orderDiscount } = await buildSalesInput(prefix, fromYmd, toYmd);
      summary = calculateSalaryFromRows(rows, wageBuf, casts, remodriRows, { orderDiscount });
    } else {
      summary = calculateSalary(await salesFile!.arrayBuffer(), wageBuf, casts, remodriRows);
    }
  } catch (e) {
    if (e instanceof CsvFormatError || e instanceof AirRegiPeriodError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  // --- 最低賃金の判定（月間トータル）---
  // 前半/後半なら、もう片方の保存済みレコードを足して月間にする。無ければ pending
  let minWage = null;
  if (year && month && half != null) {
    // 時給0のランク（内勤）はこのシートの外で払う前提なので判定から外す（2026-09-17）。外すのをやめるなら次の1行を消す
    const outOfScope = (rank: string) => rankTerms.get(rank)?.hourlyWage === 0;
    const current: MinWageInput[] = summary.casts
      .filter(c => !outOfScope(c.rank))
      .map(c => ({ castName: c.castName, salary: c.salary, commute: c.commute, workMinutes: c.workMinutes }));
    let other: MinWageInput[] | null = null;
    if (half === 1 || half === 2) {
      const otherPeriod = await prisma.salaryPeriod.findUnique({
        where: { storeName_year_month_half: { storeName: store, year, month, half: half === 1 ? 2 : 1 } },
        include: { castRecords: true },
      });
      // 旧レコード（労働時間の記録なし）しか無いときは月間にできないので pending 扱い
      if (otherPeriod && otherPeriod.castRecords.some(r => r.workMinutes > 0)) {
        other = otherPeriod.castRecords
          .filter(r => !outOfScope(r.rank))
          .map(r => ({ castName: r.castName, salary: r.salary || r.payment, commute: r.commute, workMinutes: r.workMinutes }));
      }
    }
    minWage = checkMinimumWage(prefix, year, month, half, current, other);
  }
  const extras = {
    remodriOrphans, source, wageSource,
    misekinOrphans: misekinWages?.orphans ?? [],
    misekinZeroWage: misekinWages?.zeroWageCasts ?? [],
    minWage,
  };

  // --- DB 保管（保存が指示されたときだけ）---
  if (save && year && month && half) {
    // 同じ期間があれば削除→再作成（upsert相当）
    const existing = await prisma.salaryPeriod.findUnique({
      where: { storeName_year_month_half: { storeName: store, year, month, half } },
    });
    // 確定済みは上書きしない（キャストに「確定」として見せた額を変えない）。解除してから保存し直す
    if (existing?.finalizedAt) {
      return NextResponse.json(
        { error: `${store} ${year}/${String(month).padStart(2, "0")} ${half === 1 ? "前半" : half === 2 ? "後半" : "全体"} は確定済みです。上書きするには給与履歴で「確定を解除」してください`, summary, ...extras },
        { status: 409 }
      );
    }
    if (existing) {
      await prisma.salaryPeriod.delete({ where: { id: existing.id } });
    }

    const period = await prisma.salaryPeriod.create({
      data: {
        storeName: store, year, month, half,
        castRecords: {
          create: summary.casts.map(c => ({
            castCode:    c.castCode,
            castName:    c.castName,
            hpName:      hpNameMap.get(c.castName) ?? "",
            rank:        c.rank,
            basicPay:    c.basicPay,
            commute:     c.commute,
            back:        c.back,
            payment:     c.payment,
            grossProfit: c.grossProfit,
            totalSales:  c.totalSales,
            salary:      c.salary,
            workMinutes: c.workMinutes,
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
            orderDiscount:      summary.orderDiscount,
          },
        },
      },
    });
    clearPortalCache();
    return NextResponse.json({ summary, periodId: period.id, ...extras });
  }

  return NextResponse.json({ summary, ...extras });
}
