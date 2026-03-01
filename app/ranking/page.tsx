import Link from "next/link";
import { getCastRanking } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export const revalidate = 60;

export default async function RankingPage() {
  const ranking = await getCastRanking();

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center mb-10">
          ⭐ 全体ランキング
        </h1>

        {ranking.length > 0 ? (
          <div className="space-y-3">
            {ranking.map((cast, i) => (
              <Link
                key={cast.id}
                href={`/cast/${cast.id}`}
                className="glass-dark flex items-center gap-4 p-4 hover:border-neon-violet transition-all group"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black flex-shrink-0"
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
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-white group-hover:text-neon-purple transition-colors">
                    {cast.name}
                  </div>
                  <div className="text-xs text-white/40">{cast.storeName}</div>
                </div>
                <div className="text-neon-purple font-bold">
                  {cast.totalPoints.toLocaleString()} pt
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass p-10 text-center text-white/50">
            <p className="text-lg">ランキングデータはまだありません</p>
            <p className="text-sm mt-2">ポイントをギフトするとランキングが更新されます</p>
          </div>
        )}

        <div className="text-center mt-8">
          <Link href="/" className="btn-secondary inline-block">← トップページ</Link>
        </div>
      </main>
    </>
  );
}
