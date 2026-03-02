import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMonthlyRanking } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

const STORE_INFO: Record<string, { city: string; keyword: string }> = {
  tokyo:  { city: "池袋",   keyword: "男装コンカフェ 池袋" },
  osaka:  { city: "日本橋", keyword: "男装コンカフェ 大阪 日本橋" },
  nagoya: { city: "名古屋錦", keyword: "男装コンカフェ 名古屋" },
};

export async function generateStaticParams() {
  return [{ slug: "tokyo" }, { slug: "osaka" }, { slug: "nagoya" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const info = STORE_INFO[slug];
  if (!info) return {};
  return {
    title: `${info.city}店 月間ランキング`,
    description: `星狼${info.city}店の月間キャストランキング。${info.keyword}のコスプレイヤーキャストを月間ギフトポイントでランキング表示。`,
  };
}

const RANK_BG = [
  "linear-gradient(135deg, #fbbf24, #f59e0b)",
  "linear-gradient(135deg, #9ca3af, #6b7280)",
  "linear-gradient(135deg, #b45309, #92400e)",
];

export default async function StoreRankingPage({ params }: Props) {
  const { slug } = await params;
  if (!STORE_INFO[slug]) notFound();

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const ranking = await getMonthlyRanking(store.id);
  const displayed = ranking.filter((c) => c.totalPoints > 0);

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-white/40 text-sm mb-1">{store.name}</p>
          <h1 className="text-3xl font-black gradient-text text-neon-glow">
            ⭐ 月間ランキング
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {year}年{month}月 — ギフトポイント集計
          </p>
        </div>

        {/* ナビ */}
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/ranking"
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
                <div className="relative w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-night-900">
                  <Image
                    src={cast.imageUrl || "/images/cast-placeholder.jpg"}
                    alt={cast.name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
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
            <p className="text-lg">今月のランキングデータはまだありません</p>
            <p className="text-sm mt-2">ポイントをギフトするとランキングが更新されます</p>
          </div>
        )}
      </main>
    </>
  );
}
