import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance, getUserTitle } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export default async function MePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const [user, balance, titleInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, createdAt: true },
    }),
    getUserBalance(session.userId),
    getUserTitle(session.userId),
  ]);

  if (!user) redirect("/auth/login");

  // 最近のGIFT履歴
  const recentGifts = await prisma.pointLedger.findMany({
    where: { fromUserId: session.userId, type: "GIFT" },
    include: { cast: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const progressPct = titleInfo.next
    ? Math.min(
        100,
        Math.round((titleInfo.cumulativeTotal / titleInfo.next.threshold) * 100)
      )
    : 100;

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center">
          マイページ
        </h1>

        {/* プロフィール */}
        <div className="glass p-6 space-y-2">
          <p className="text-white/50 text-xs">メールアドレス</p>
          <p className="text-white font-medium">{user.email}</p>
          <p className="text-white/50 text-xs mt-2">ロール</p>
          <p className="text-neon-purple font-bold">
            {user.role === "ADMIN" ? "⚙️ 管理者" : "⭐ 会員"}
          </p>
        </div>

        {/* ポイント残高 */}
        <div className="glass p-6 text-center">
          <p className="text-white/50 text-sm mb-1">保有ポイント</p>
          <p className="text-5xl font-black text-star-300 text-star-glow">
            {balance.toLocaleString()}
            <span className="text-xl font-normal text-white/50 ml-1">pt</span>
          </p>
          <Link href="/gift" className="btn-primary inline-block mt-4 text-sm">
            🎁 キャストにプレゼント
          </Link>
        </div>

        {/* 称号 */}
        <div className="glass p-6 space-y-3">
          <h2 className="text-lg font-bold text-star-300">🏆 現在の称号</h2>
          <p className="text-2xl font-black text-white text-neon-glow">
            {titleInfo.current?.name ?? "---"}
          </p>
          <p className="text-white/50 text-sm">
            累計ギフトポイント: {titleInfo.cumulativeTotal.toLocaleString()} pt
          </p>
          {titleInfo.next && (
            <div>
              <div className="flex justify-between text-xs text-white/50 mb-1">
                <span>次の称号: {titleInfo.next.name}</span>
                <span>あと {titleInfo.pointsToNext?.toLocaleString()} pt</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #7c3aed, #c026d3)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ギフト履歴 */}
        {recentGifts.length > 0 && (
          <div className="glass p-6 space-y-3">
            <h2 className="text-lg font-bold text-star-300">🎁 最近のギフト履歴</h2>
            <div className="space-y-2">
              {recentGifts.map((g) => (
                <div
                  key={g.id}
                  className="flex justify-between items-center text-sm border-b border-white/10 pb-2"
                >
                  <span className="text-white/70">
                    {g.cast?.name ?? "不明"} へギフト
                  </span>
                  <span className="text-neon-purple font-bold">
                    -{g.amount.toLocaleString()} pt
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <Link href="/ranking" className="btn-secondary text-sm">ランキングを見る</Link>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ログアウト
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
