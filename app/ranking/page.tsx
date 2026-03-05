import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getMonthlyRanking } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "月間ランキング",
  description:
    "星狼の月間キャストランキング。池袋・日本橋・名古屋の全店舗を対象に、今月ポイントを最も受け取ったキャストをランキング形式で表示します。",
};

const STORES = [
  { slug: "tokyo",  name: "池袋店" },
  { slug: "osaka",  name: "日本橋店" },
  { slug: "nagoya", name: "名古屋栄店" },
];

const RANK_BG = [
  "linear-gradient(135deg, #fbbf24, #f59e0b)",
  "linear-gradient(135deg, #9ca3af, #6b7280)",
  "linear-gradient(135deg, #b45309, #92400e)",
];

export default async function RankingPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const ranking = await getMonthlyRanking();
  const displayed = ranking.filter((c) => c.totalPoints > 0);

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black gradient-text text-neon-glow">
            ⭐ 月間ランキング
          </h1>
          <p className="text-white/50 text-sm mt-2">
            {year}年{month}月 — ギフトポイント集計
          </p>
        </div>

        {/* 店舗別ランキングへのリンク */}
        <div className="glass p-4">
          <p className="text-white/60 text-xs mb-3 text-center">店舗別ランキング</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {STORES.map((s) => (
              <Link
                key={s.slug}
                href={`/ranking/${s.slug}`}
                className="glass-dark px-4 py-2 text-sm text-white/80 hover:text-neon-purple hover:border-neon-violet transition-all rounded-full"
              >
                {s.name} →
              </Link>
            ))}
          </div>
        </div>

        {/* 全体ランキング */}
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
                  <div className="text-xs text-white/40">{cast.storeName}</div>
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

        <div className="text-center">
          <Link href="/" className="btn-secondary inline-block">← トップページ</Link>
        </div>
      </main>
    </>
  );
}
