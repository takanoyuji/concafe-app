import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMonthlyRanking, getCastRanking } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string; month?: string; mode?: string }>;
}

const STORE_INFO: Record<string, { city: string; keyword: string }> = {
  tokyo:  { city: "池袋",   keyword: "男装コンカフェ 池袋" },
  osaka:  { city: "日本橋", keyword: "男装コンカフェ 大阪 日本橋" },
  nagoya: { city: "名古屋栄", keyword: "男装コンカフェ 名古屋" },
};

export async function generateStaticParams() {
  return [{ slug: "tokyo" }, { slug: "osaka" }, { slug: "nagoya" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const info = STORE_INFO[slug];
  if (!info) return {};
  return {
    title: `${info.city}店 ランキング`,
    description: `星狼${info.city}店のキャストランキング。${info.keyword}のコスプレイヤーキャストをギフトポイントでランキング表示。`,
  };
}

const RANK_BG = [
  "linear-gradient(135deg, #fbbf24, #f59e0b)",
  "linear-gradient(135deg, #9ca3af, #6b7280)",
  "linear-gradient(135deg, #b45309, #92400e)",
];

export default async function StoreRankingPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!STORE_INFO[slug]) notFound();

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const sp = await searchParams;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const year = sp.year ? parseInt(sp.year, 10) : curYear;
  const month = sp.month ? parseInt(sp.month, 10) : curMonth;
  const mode = sp.mode === "cumulative" ? "cumulative" : "monthly";

  const isFuture = year > curYear || (year === curYear && month > curMonth);
  const safeYear = isFuture ? curYear : year;
  const safeMonth = isFuture ? curMonth : month;

  const prevMonth = safeMonth === 1 ? 12 : safeMonth - 1;
  const prevYear = safeMonth === 1 ? safeYear - 1 : safeYear;
  const nextMonth = safeMonth === 12 ? 1 : safeMonth + 1;
  const nextYear = safeMonth === 12 ? safeYear + 1 : safeYear;
  const isCurrentMonth = safeYear === curYear && safeMonth === curMonth;

  const ranking =
    mode === "cumulative"
      ? await getCastRanking(store.id)
      : await getMonthlyRanking(store.id, safeYear, safeMonth);
  const displayed = ranking.filter((c) => c.totalPoints > 0);

  const monthlyHref = (y: number, m: number) =>
    `/ranking/${slug}?year=${y}&month=${m}&mode=monthly`;
  const cumulativeHref = `/ranking/${slug}?mode=cumulative`;

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-white/40 text-sm mb-1">{store.name}</p>
          <h1 className="text-3xl font-black gradient-text text-neon-glow">
            ⭐ ランキング
          </h1>
        </div>

        {/* モード切り替え */}
        <div className="flex gap-2 justify-center">
          <Link
            href={monthlyHref(safeYear, safeMonth)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              mode === "monthly"
                ? "bg-neon-purple text-white"
                : "glass-dark text-white/60 hover:text-white"
            }`}
          >
            月間
          </Link>
          <Link
            href={cumulativeHref}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
              mode === "cumulative"
                ? "bg-neon-purple text-white"
                : "glass-dark text-white/60 hover:text-white"
            }`}
          >
            累計
          </Link>
        </div>

        {/* 月ナビ（月間モードのみ） */}
        {mode === "monthly" && (
          <div className="flex items-center justify-center gap-4">
            <Link
              href={monthlyHref(prevYear, prevMonth)}
              className="glass-dark px-4 py-2 text-sm text-white/70 hover:text-white rounded-full transition-all"
            >
              ‹ 前月
            </Link>
            <span className="text-white font-bold text-sm min-w-[8rem] text-center">
              {safeYear}年{safeMonth}月
            </span>
            {isCurrentMonth ? (
              <span className="px-4 py-2 text-sm text-white/30 rounded-full cursor-not-allowed">
                翌月 ›
              </span>
            ) : (
              <Link
                href={monthlyHref(nextYear, nextMonth)}
                className="glass-dark px-4 py-2 text-sm text-white/70 hover:text-white rounded-full transition-all"
              >
                翌月 ›
              </Link>
            )}
          </div>
        )}

        {/* 累計モード説明 */}
        {mode === "cumulative" && (
          <p className="text-center text-white/40 text-xs">サービス開始からの累計ギフトポイント集計</p>
        )}

        {/* ナビ */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href={
              mode === "cumulative"
                ? `/ranking?mode=cumulative`
                : `/ranking?year=${safeYear}&month=${safeMonth}&mode=monthly`
            }
            className="glass-dark px-4 py-2 text-sm text-white/70 hover:text-white hover:border-neon-violet transition-all rounded-full"
          >
            ← 全体ランキング
          </Link>
          <Link
            href={`/store/${slug}`}
            className="glass-dark px-4 py-2 text-sm text-white/70 hover:text-white hover:border-neon-violet transition-all rounded-full"
          >
            {store.name} 店舗ページ
          </Link>
        </div>

        {displayed.length > 0 ? (
          <div className="space-y-3">
            {displayed.map((cast, i) => (
              <Link
                key={cast.id}
                href={`/cast/${cast.id}`}
                className="glass-dark flex items-center gap-4 p-4 hover:border-neon-violet transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                  style={{
                    background: i < 3 ? RANK_BG[i] : "rgba(255,255,255,0.1)",
                    color: i < 3 ? "#06040f" : "#f0eafa",
                  }}
                >
                  {i + 1}
                </div>
                <div className="relative w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center">
                  {cast.imageUrl ? (
                    <Image
                      src={cast.imageUrl}
                      alt={cast.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-lg">🐺</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white group-hover:text-neon-purple transition-colors truncate">
                    {cast.name}
                  </div>
                </div>
                <div className="text-neon-purple font-bold whitespace-nowrap">
                  {cast.totalPoints.toLocaleString()} pt
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass p-10 text-center text-white/50">
            <p className="text-lg">
              {mode === "cumulative" ? "累計" : `${safeYear}年${safeMonth}月`}のランキングデータはまだありません
            </p>
            <p className="text-sm mt-2">ポイントをギフトするとランキングが更新されます</p>
          </div>
        )}
      </main>
    </>
  );
}
