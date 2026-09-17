/**
 * キャストポータル（docs/cast-portal-requirements.md）と管理画面の売上タブの集計。
 *
 * - 報酬: 確定済み → 保存レコード（不変）/ 保存済み → 保存レコード（速報）/ 無い → ライブ計算（速報）
 * - 売上一覧: 来店は Airレジ取込（カテゴリー＝キャストの店舗別エアレジ名）、遠隔は remodri（キャストコード）
 * - 日次売上: 来店は Airレジの伝票合計、遠隔は remodri の日別（キャストの所属店舗基準）
 *
 * ⚠️ キャスト向けに返す値に 時給・労働時間・基本給・通勤手当・バック率・最低賃金 を含めない（要件 1）。
 *    ここで組み立てる CastRewardMonth はその制約で作ってある。画面側で SalaryCastRecord を直接読まないこと。
 */
import { prisma } from "@/lib/prisma";
import { calculateSalaryFromRows, halfPeriodRange, type CastInput, type SalarySummary } from "@/lib/salary";
import { buildSalesInput, buildSalesRows, assertPeriodComplete } from "@/lib/airregiSales";
import { transactionSign } from "@/lib/airregi";
import {
  fetchRemodriSalesByCast, fetchRemodriSalesByDate, attributeByPrimaryStore, isRemodriConfigured,
  type RemodriCastSales, type RemodriStoreCode,
} from "@/lib/remodri";
import { fetchMisekinAttendance, buildWagesFromAttendance, isMisekinConfigured, type MisekinWages } from "@/lib/misekin";
import { getRanksForPeriod } from "@/lib/rank";

export type StorePrefix = "tokyo" | "osaka" | "nagoya";
export const STORE_PREFIXES: StorePrefix[] = ["tokyo", "osaka", "nagoya"];
/** SalaryPeriod.storeName の表記 */
export const STORE_NAME: Record<StorePrefix, string> = { tokyo: "東京", osaka: "大阪", nagoya: "名古屋" };

export function storePrefixOfName(storeName: string): StorePrefix | null {
  if (storeName.includes("池袋") || storeName === "東京") return "tokyo";
  if (storeName.includes("日本橋") || storeName === "大阪") return "osaka";
  if (storeName.includes("名古屋")) return "nagoya";
  return null;
}

// ---------------------------------------------------------------------------
// 小さなメモリキャッシュ（プロセス内・TTL）。コンテナ1台なのでこれで足りる
// ---------------------------------------------------------------------------
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 10 * 60 * 1000;
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}
/** テストと確定操作の直後に使う */
export function clearPortalCache() { cache.clear(); }

// ---------------------------------------------------------------------------
// 日付ユーティリティ
// ---------------------------------------------------------------------------
export function jstToday(): { year: number; month: number; day: number; ymd: string } {
  return jstDate(0);
}
/** 日本時間で今日から offsetDays ずらした日付 */
export function jstDate(offsetDays: number): { year: number; month: number; day: number; ymd: string } {
  const t = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  const year = t.getUTCFullYear(), month = t.getUTCMonth() + 1, day = t.getUTCDate();
  return { year, month, day, ymd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

/** 当月から過去 n ヶ月（新しい順） */
export function recentMonths(n: number): { year: number; month: number }[] {
  const { year, month } = jstToday();
  const out: { year: number; month: number }[] = [];
  let y = year, m = month;
  for (let i = 0; i < n; i++) {
    out.push({ year: y, month: m });
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  return halfPeriodRange(year, month, 0);
}

// ---------------------------------------------------------------------------
// ログインユーザー → キャスト
// ---------------------------------------------------------------------------
export async function getCastByUserId(userId: string) {
  return prisma.cast.findUnique({
    where: { userId },
    include: { stores: { where: { isPrimary: true }, take: 1, include: { store: { select: { slug: true, name: true } } } } },
  });
}

// ---------------------------------------------------------------------------
// ライブの給与計算（店舗×半月）。管理画面の「Airレジ API ＋ みせ勤」経路と同じ材料で計算する。
// 管理画面のルート（app/api/admin/salary/route.ts）はCSV入力も扱うため共通化せず、API経路だけをここに写した。
// 計算式そのものは lib/salary.ts の1箇所なので、ずれない。
// ---------------------------------------------------------------------------
export class LiveCalcUnavailable extends Error {
  constructor(message: string) { super(message); this.name = "LiveCalcUnavailable"; }
}

export async function computeLiveStoreSalary(prefix: StorePrefix, year: number, month: number, half: 0 | 1 | 2): Promise<SalarySummary> {
  return cached(`live:${prefix}:${year}-${month}-${half}`, async () => {
    const { from, to } = halfPeriodRange(year, month, half);
    const [masters, castRanks, monthlyRankMap] = await Promise.all([
      prisma.cast.findMany({
        where: { retired: false },
        include: { stores: { where: { isPrimary: true }, take: 1, include: { store: { select: { slug: true } } } } },
      }),
      prisma.castRank.findMany(),
      getRanksForPeriod(year, month),
    ]);
    const rankMap = new Map(castRanks.map(r => [r.name, r] as const));
    const effectiveRankOf = (m: (typeof masters)[number]) => monthlyRankMap?.get(m.id) ?? m.rank;
    const regiField = `${prefix}AirRegi` as keyof (typeof masters)[number];
    const shiftField = `${prefix}AirShift` as keyof (typeof masters)[number];

    // 遠隔
    let remodriRows: RemodriCastSales[] = [];
    if (isRemodriConfigured()) {
      const all = await fetchRemodriSalesByCast(from, to);
      const primaryByCode = new Map(
        masters.map(m => [m.castCode, m.stores[0]?.store.slug] as const).filter((e): e is readonly [string, string] => Boolean(e[1]))
      );
      remodriRows = attributeByPrimaryStore(all, primaryByCode, prefix).mine;
    }

    // 人件費（みせ勤）。未設定なら稼働報酬0で進める（売上連動報酬だけの速報になる）
    let wages: MisekinWages = { kind: "misekin", byCastCode: new Map(), orphans: [], count: 0, zeroWageCasts: [] };
    if (isMisekinConfigured()) {
      const rows = await fetchMisekinAttendance(prefix, from, to);
      const terms = new Map(masters.map(m => {
        const rank = effectiveRankOf(m);
        return [m.castCode, { rank, hourlyWage: rankMap.get(rank)?.hourlyWage ?? 0, commuteDaily: m.commuteDaily }] as const;
      }));
      wages = buildWagesFromAttendance(rows, terms); // 退勤打刻なしは MisekinError（呼び出し元で「集計中」にする）
    }

    const hasRemodri = new Set(remodriRows.map(r => r.castCode));
    const hasMisekin = new Set(wages.byCastCode.keys());
    const casts: CastInput[] = masters
      .filter(m => m[regiField] || m[shiftField] || hasRemodri.has(m.castCode) || hasMisekin.has(m.castCode))
      .map(m => {
        const rank = effectiveRankOf(m);
        return {
          castCode: m.castCode,
          castName: String(m[regiField] || ""),
          airShiftName: String(m[shiftField] || ""),
          rank,
          backRate: rankMap.get(rank)?.backRate ?? 0,
          exemptFromCommuteRule: false,
          commutePaid: rankMap.get(rank)?.commutePaid,
        };
      })
      .filter(c => c.castName || c.airShiftName || hasMisekin.has(c.castCode));

    // 進行中の期間は「前日まで」で判定・集計する（Airレジは毎朝8時に前日分まで。当日以降を要求すると月末まで永遠に止まる）
    const yesterday = jstDate(-1).ymd;
    const effTo = to < yesterday ? to : yesterday;
    const fromYmd = from.replace(/-/g, ""), toYmd = effTo.replace(/-/g, "");
    await assertPeriodComplete(prefix, fromYmd, toYmd); // 取り込み漏れは AirRegiPeriodError
    const { rows, orderDiscount } = await buildSalesInput(prefix, fromYmd, toYmd);
    return calculateSalaryFromRows(rows, wages, casts, remodriRows, { orderDiscount });
  });
}

// ---------------------------------------------------------------------------
// 報酬（キャスト本人向け）
// ---------------------------------------------------------------------------
export interface CastRewardHalf {
  half: 1 | 2;
  /** final=確定 / saved=保存済み（速報） / live=ライブ計算（速報） / pending=集計できない / none=データなし */
  source: "final" | "saved" | "live" | "pending" | "none";
  /** 稼働報酬 = 合計 − 売上連動報酬 */
  activity: number;
  /** 売上連動報酬（バック） */
  salesLinked: number;
  /** 合計（100円丸め後の支払額） */
  total: number;
  /** pending のときの理由（キャスト向けの言葉） */
  note?: string;
}

export interface CastRewardMonth {
  year: number;
  month: number;
  status: "final" | "provisional";
  activity: number;
  salesLinked: number;
  total: number;
  halves: CastRewardHalf[];
}

/** ライブ計算を試みる対象は直近3ヶ月まで。それより前で保存が無い期間は「データなし」 */
const LIVE_MONTHS = 3;

function isWithinLiveWindow(year: number, month: number): boolean {
  const now = jstToday();
  const diff = (now.year - year) * 12 + (now.month - month);
  return diff >= 0 && diff < LIVE_MONTHS;
}

/** 給与（丸め前）。2026-09-17 より前の保存レコードは salary 列が無く 0 なので、支払額で代用する */
function salaryOf(r: { salary: number; payment: number }): number {
  return r.salary || r.payment;
}

/** 本人の行を、castCode → hpName → castName の順で引く（旧レコードは castCode が空） */
function pickRecord<T extends { castCode?: string; hpName?: string; castName: string }>(
  rows: T[], cast: { castCode: string; name: string }, regiName: string
): T | undefined {
  return rows.find(r => r.castCode && r.castCode === cast.castCode)
    ?? rows.find(r => r.hpName && r.hpName === cast.name)
    ?? (regiName ? rows.find(r => r.castName === regiName) : undefined);
}

export async function castRewardsByMonth(
  cast: { id: string; castCode: string; name: string; tokyoAirRegi: string; osakaAirRegi: string; nagoyaAirRegi: string },
  months: { year: number; month: number }[]
): Promise<CastRewardMonth[]> {
  const out: CastRewardMonth[] = [];
  for (const { year, month } of months) {
    const periods = await prisma.salaryPeriod.findMany({
      where: { year, month },
      include: { castRecords: true },
    });
    const halves: CastRewardHalf[] = [];
    for (const half of [1, 2] as const) {
      let activityBase = 0, salesLinked = 0, total = 0;
      let anyFinal = false, anyProvisional = false, anyPending = false, anyData = false;
      let note: string | undefined;
      for (const prefix of STORE_PREFIXES) {
        const storeName = STORE_NAME[prefix];
        const regiName = String(cast[`${prefix}AirRegi`] || "");
        // 全月保存（half=0）があればそれを半分ずつではなく、前半にまとめて載せる（表示は月で畳むので同じ）
        const whole = periods.find(p => p.storeName === storeName && p.half === 0);
        const saved = periods.find(p => p.storeName === storeName && p.half === half);
        if (whole) {
          const r = pickRecord(whole.castRecords, cast, regiName);
          if (r) {
            anyData = true;
            if (whole.finalizedAt) anyFinal = true; else anyProvisional = true;
            // 全月保存は額を前半の行にまとめて載せ、後半は同じ状態で0にする（表示は月で畳むので合計は同じ）
            if (half === 1) { activityBase += salaryOf(r) - r.back; salesLinked += r.back; total += r.payment; }
            else note = "全月でまとめて集計";
          }
          continue;
        }
        if (saved) {
          const r = pickRecord(saved.castRecords, cast, regiName);
          if (r) {
            anyData = true;
            if (saved.finalizedAt) anyFinal = true; else anyProvisional = true;
            activityBase += salaryOf(r) - r.back; salesLinked += r.back; total += r.payment;
          }
          continue;
        }
        if (!isWithinLiveWindow(year, month)) continue;
        // 期間の初日が昨日より後（＝まだ集計できる日が無い）なら何もしない
        const { from } = halfPeriodRange(year, month, half);
        if (from > jstDate(-1).ymd) continue;
        try {
          const summary = await computeLiveStoreSalary(prefix, year, month, half);
          const r = pickRecord(summary.casts, cast, regiName);
          // 計算に載っている（エアレジ名・打刻・遠隔のどれかがある）なら、0円でも「速報 ¥0」として出す
          if (r) {
            anyData = true; anyProvisional = true;
            activityBase += r.salary - r.back; salesLinked += r.back; total += r.payment;
          }
        } catch (e) {
          // 取り込み漏れ・退勤打刻なし・外部APIの障害。誤った額を見せるより出さない
          anyPending = true;
          note = "集計中（まだ計算できないデータがあります）";
          void e;
        }
      }
      // 合計は100円丸め後の支払額。丸めの差は売上連動報酬に寄せ、稼働報酬がマイナスに見えないようにする
      const activity = Math.max(0, Math.round(activityBase));
      const totalR = Math.round(total);
      halves.push({
        half,
        source: anyPending && !anyData ? "pending" : !anyData ? "none" : anyFinal && !anyProvisional && !anyPending ? "final" : "live",
        activity, salesLinked: totalR - activity, total: totalR,
        note,
      });
    }
    const status: CastRewardMonth["status"] =
      halves.some(h => h.source === "none" || h.source === "pending" || h.source === "live") ? "provisional" : "final";
    out.push({
      year, month, status,
      activity: halves.reduce((a, h) => a + h.activity, 0),
      salesLinked: halves.reduce((a, h) => a + h.salesLinked, 0),
      total: halves.reduce((a, h) => a + h.total, 0),
      halves,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 月別売上（キャスト全員向け）
// ---------------------------------------------------------------------------
export interface CastMonthlySalesRow {
  castCode: string;
  name: string;
  local: number;   // 来店（税込）
  remote: number;  // 遠隔（税込）
  total: number;
}

export async function castMonthlySales(year: number, month: number): Promise<{ rows: CastMonthlySalesRow[]; asOf: { airRegi: string; remodri: string } }> {
  return cached(`sales:${year}-${month}`, async () => {
    const { from, to } = monthRange(year, month);
    const fromYmd = from.replace(/-/g, ""), toYmd = to.replace(/-/g, "");
    const casts = await prisma.cast.findMany({ where: { retired: false } });
    const byCode = new Map(casts.map(c => [c.castCode, { castCode: c.castCode, name: c.name, local: 0, remote: 0, total: 0 }]));

    // 来店: 店舗ごとに カテゴリー → キャスト（店舗別エアレジ名）
    for (const prefix of STORE_PREFIXES) {
      const regiField = `${prefix}AirRegi` as const;
      const codeByRegi = new Map(casts.filter(c => c[regiField]).map(c => [c[regiField], c.castCode]));
      const rows = await buildSalesRows(prefix, fromYmd, toYmd);
      for (const r of rows) {
        const code = codeByRegi.get(r.カテゴリー);
        if (!code) continue;
        const taxIncl = r.税区分?.trim() === "外税" ? Math.round(r.販売総売上 * 1.1) : r.販売総売上;
        const row = byCode.get(code)!;
        // Airレジに残る「遠隔_」カテゴリー（remodri 移行前）は遠隔に数える
        if (r.isRemote) row.remote += taxIncl; else row.local += taxIncl;
      }
    }
    // 遠隔: remodri（キャストコード）
    if (isRemodriConfigured()) {
      const rem = await fetchRemodriSalesByCast(from, to);
      for (const r of rem) {
        const row = byCode.get(r.castCode);
        if (row) row.remote += r.amount;
      }
    }
    for (const row of byCode.values()) row.total = row.local + row.remote;
    const rows = [...byCode.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ja"));

    // Airレジは毎朝8時に前日分まで。取り込み台帳の最新日を「〜まで」として出す
    const latest = await prisma.airRegiSyncLog.findFirst({ where: { status: "ok" }, orderBy: { businessDate: "desc" }, select: { businessDate: true } });
    const airRegi = latest ? `${latest.businessDate.slice(0, 4)}/${latest.businessDate.slice(4, 6)}/${latest.businessDate.slice(6, 8)}` : "—";
    return { rows, asOf: { airRegi, remodri: "現在" } };
  });
}

// ---------------------------------------------------------------------------
// 店舗の日次売上（管理画面）
// ---------------------------------------------------------------------------
export interface StoreDailySalesRow {
  businessDate: string; // YYYY-MM-DD
  local: number;        // 来店（伝票合計・税込。赤伝はマイナス）
  remote: number;       // 遠隔（税込・キャストの所属店舗基準）
  total: number;
  /** Airレジの取り込みが無い日（0円の日は ok で載るのでここには来ない） */
  airRegiMissing: boolean;
}

export async function storeDailySales(prefix: StorePrefix, year: number, month: number): Promise<{ rows: StoreDailySalesRow[]; remodriError?: string }> {
  return cached(`daily:${prefix}:${year}-${month}`, async () => {
    const { from, to } = monthRange(year, month);
    const fromYmd = from.replace(/-/g, ""), toYmd = to.replace(/-/g, "");
    const [txs, logs] = await Promise.all([
      prisma.airRegiTransaction.findMany({
        where: { storeSlug: prefix, businessDate: { gte: fromYmd, lte: toYmd } },
        select: { businessDate: true, totalAmount: true, transactionType: true, canceledFlg: true },
      }),
      prisma.airRegiSyncLog.findMany({ where: { storeSlug: prefix, businessDate: { gte: fromYmd, lte: toYmd }, status: "ok" }, select: { businessDate: true } }),
    ]);
    const okDays = new Set(logs.map(l => l.businessDate));
    const local = new Map<string, number>();
    for (const t of txs) {
      local.set(t.businessDate, (local.get(t.businessDate) ?? 0) + transactionSign(t) * t.totalAmount);
    }
    const remote = new Map<string, number>();
    let remodriError: string | undefined;
    if (isRemodriConfigured()) {
      try {
        for (const r of await fetchRemodriSalesByDate(from, to, prefix as RemodriStoreCode)) remote.set(r.businessDate, r.amount);
      } catch (e) {
        remodriError = e instanceof Error ? e.message : String(e);
      }
    }
    const today = jstToday().ymd;
    const rows: StoreDailySalesRow[] = [];
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let d = 1; d <= last; d++) {
      const ymd = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (ymd >= today) break; // 当日以降は取り込み前
      const l = local.get(ymd.replace(/-/g, "")) ?? 0;
      const r = remote.get(ymd) ?? 0;
      rows.push({ businessDate: ymd, local: l, remote: r, total: l + r, airRegiMissing: !okDays.has(ymd.replace(/-/g, "")) });
    }
    return { rows, remodriError };
  });
}
