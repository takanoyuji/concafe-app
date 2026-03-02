import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getMonthlyRanking } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

interface Props {
  params: Promise<{ slug: string }>;
}

const STORE_DESC: Record<string, string> = {
  tokyo:
    "池袋駅東口から徒歩5分。ネオン輝く夜の空間で、星狼の男装キャストが温かくお迎えします。",
  osaka:
    "日本橋でんでんタウン近く。関西唯一の星狼店舗として、大阪の夜をより一層特別に彩ります。",
  nagoya:
    "名古屋錦の中心地に位置する星狼名古屋店。洗練された空間でキャストとの時間をお楽しみください。",
};

export async function generateStaticParams() {
  return [{ slug: "tokyo" }, { slug: "osaka" }, { slug: "nagoya" }];
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: { casts: { orderBy: { order: "asc" } } },
  });

  if (!store) notFound();

  const ranking = await getMonthlyRanking(store.id);
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(store.mapQuery)}&output=embed&hl=ja`;

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-20 pb-16 px-4 max-w-4xl mx-auto">
        {/* 店舗ヘッダー */}
        <div className="glass p-8 mb-8 text-center">
          <h1 className="text-3xl font-black gradient-text text-neon-glow mb-2">
            {store.name}
          </h1>
          <address className="not-italic text-white/60 text-sm mb-4">
            {store.address}
          </address>
          <p className="text-white/80 leading-relaxed">
            {STORE_DESC[slug] ?? ""}
          </p>
        </div>

        {/* Google Maps */}
        <div className="rounded-xl overflow-hidden mb-8 border border-white/10">
          <iframe
            src={mapSrc}
            width="100%"
            height="300"
            style={{ border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`${store.name}の地図`}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* キャスト一覧 */}
          <section>
            <h2 className="text-xl font-bold text-star-300 text-star-glow mb-4">
              🐺 在籍キャスト
            </h2>
            {store.casts.length > 0 ? (
              <div className="space-y-3">
                {store.casts.map((cast) => (
                  <Link
                    key={cast.id}
                    href={`/cast/${cast.id}`}
                    className="glass-dark flex items-center gap-4 p-4 hover:border-neon-violet transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center text-xl flex-shrink-0">
                      🐺
                    </div>
                    <div>
                      <div className="font-bold text-white">{cast.name}</div>
                      <div className="text-xs text-white/50 line-clamp-1">{cast.bio}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass p-6 text-white/50 text-center">
                キャスト情報は近日公開予定です
              </div>
            )}
          </section>

          {/* 店舗別ランキング */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-star-300 text-star-glow">
                ⭐ 月間ランキング
              </h2>
              <Link href={`/ranking/${slug}`} className="text-xs text-neon-purple hover:text-neon-violet transition-colors">
                詳細を見る →
              </Link>
            </div>
            {ranking.length > 0 ? (
              <div className="space-y-3">
                {ranking.map((cast, i) => (
                  <Link
                    key={cast.id}
                    href={`/cast/${cast.id}`}
                    className="glass-dark flex items-center gap-4 p-4 hover:border-neon-violet transition-all"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                      style={{
                        background:
                          i === 0
                            ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                            : i === 1
                            ? "linear-gradient(135deg, #9ca3af, #6b7280)"
                            : i === 2
                            ? "linear-gradient(135deg, #b45309, #92400e)"
                            : "rgba(255,255,255,0.1)",
                        color: i < 3 ? "#06040f" : "#f0eafa",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-white">{cast.name}</div>
                    </div>
                    <div className="text-neon-purple font-bold text-sm">
                      {cast.totalPoints.toLocaleString()} pt
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass p-6 text-white/50 text-center">
                ランキングデータはまだありません
              </div>
            )}
          </section>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="btn-secondary inline-block">
            ← トップページに戻る
          </Link>
        </div>
      </main>
    </>
  );
}
