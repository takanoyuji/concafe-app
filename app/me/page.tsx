import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserBalance, getUserTitle } from "@/lib/points";
import NavBar from "@/components/ui/NavBar";

export const dynamic = "force-dynamic";

function calcAge(birthdate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthdate.getFullYear();
  const m = today.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
  return age;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function MePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const isAdmin = session.role === "ADMIN";

  const [user, balance, titleInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, email: true, role: true, birthdate: true, ageVerified: true, createdAt: true,
        name: true, favoriteStoreId: true, favoriteCast1Id: true, favoriteCast2Id: true,
      },
    }),
    getUserBalance(session.userId),
    getUserTitle(session.userId),
  ]);

  if (!user) redirect("/auth/login");

  // プロフィール表示用：店舗・キャスト名を解決
  const [favoriteStore, favoriteCast1, favoriteCast2] = await Promise.all([
    user.favoriteStoreId
      ? prisma.store.findUnique({ where: { id: user.favoriteStoreId }, select: { name: true } })
      : null,
    user.favoriteCast1Id
      ? prisma.cast.findUnique({ where: { id: user.favoriteCast1Id }, select: { name: true } })
      : null,
    user.favoriteCast2Id
      ? prisma.cast.findUnique({ where: { id: user.favoriteCast2Id }, select: { name: true } })
      : null,
  ]);

  // 最近のGIFT履歴（一般ユーザー用）
  const recentGifts = await prisma.pointLedger.findMany({
    where: { fromUserId: session.userId, type: "GIFT" },
    include: { cast: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // 管理者専用データ
  let allGifts: Array<{
    id: string;
    amount: number;
    createdAt: Date;
    fromUser: { email: string } | null;
    cast: { name: string; store: { name: string } } | null;
  }> = [];
  let customers: Array<{
    id: string;
    email: string;
    emailVerified: boolean;
    birthdate: Date | null;
    ageVerified: boolean;
    createdAt: Date;
    balance: number;
  }> = [];

  if (isAdmin) {
    const [giftsRaw, usersRaw] = await Promise.all([
      prisma.pointLedger.findMany({
        where: { type: "GIFT" },
        include: {
          fromUser: { select: { email: true } },
          cast: { select: { name: true, store: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.user.findMany({
        where: { role: "CUSTOMER" },
        select: { id: true, email: true, emailVerified: true, birthdate: true, ageVerified: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    allGifts = giftsRaw;
    customers = await Promise.all(
      usersRaw.map(async (u) => ({
        ...u,
        balance: await getUserBalance(u.id),
      }))
    );
  }

  const progressPct = titleInfo.next
    ? Math.min(100, Math.round((titleInfo.cumulativeTotal / titleInfo.next.threshold) * 100))
    : 100;

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center">
          マイページ
        </h1>

        {/* プロフィール */}
        <div className="glass p-6 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/50 text-xs">プロフィール</span>
            <Link href="/me/profile" className="text-neon-purple text-xs hover:underline">
              編集
            </Link>
          </div>
          {user.name ? (
            <>
              <p className="text-white/50 text-xs">お名前</p>
              <p className="text-white font-bold text-lg">{user.name}</p>
            </>
          ) : (
            <p className="text-white/30 text-sm">
              名前が未設定です。{" "}
              <Link href="/me/profile" className="text-neon-purple hover:underline">設定する</Link>
            </p>
          )}
          {favoriteStore && (
            <>
              <p className="text-white/50 text-xs mt-2">よく行く店舗</p>
              <p className="text-white/80 text-sm">{favoriteStore.name}</p>
            </>
          )}
          {(favoriteCast1 || favoriteCast2) && (
            <>
              <p className="text-white/50 text-xs mt-2">推しキャスト</p>
              <div className="flex gap-2 flex-wrap">
                {favoriteCast1 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                    {favoriteCast1.name}
                  </span>
                )}
                {favoriteCast2 && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-neon-purple/20 text-neon-purple border border-neon-purple/30">
                    {favoriteCast2.name}
                  </span>
                )}
              </div>
            </>
          )}
          <p className="text-white/50 text-xs mt-3">メールアドレス</p>
          <p className="text-white font-medium">{user.email}</p>
          <p className="text-white/50 text-xs mt-2">ロール</p>
          <p className="text-neon-purple font-bold">
            {user.role === "ADMIN" ? "⚙️ 管理者" : "⭐ 会員"}
          </p>
          {user.birthdate && (
            <>
              <p className="text-white/50 text-xs mt-2">年齢</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-medium">{calcAge(new Date(user.birthdate))} 歳</p>
                {user.ageVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                    ✓ 年齢確認済み
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    年齢確認待ち
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* ポイント残高 */}
        <div className="glass p-6 text-center">
          <p className="text-white/50 text-sm mb-1">保有ポイント（今月分）</p>
          <p className="text-5xl font-black text-star-300 text-star-glow">
            {balance.toLocaleString()}
            <span className="text-xl font-normal text-white/50 ml-1">pt</span>
          </p>
          <p className="text-white/30 text-xs mt-2">
            有効期限: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString("ja-JP")} まで
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
                  style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #7c3aed, #c026d3)" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ギフト履歴（一般ユーザー） */}
        {!isAdmin && recentGifts.length > 0 && (
          <div className="glass p-6 space-y-3">
            <h2 className="text-lg font-bold text-star-300">🎁 最近のギフト履歴</h2>
            <div className="space-y-2">
              {recentGifts.map((g) => (
                <div key={g.id} className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                  <span className="text-white/70">{g.cast?.name ?? "不明"} へギフト</span>
                  <span className="text-neon-purple font-bold">-{g.amount.toLocaleString()} pt</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====== 管理者専用セクション ====== */}
        {isAdmin && (
          <>
            {/* ギフト全履歴 */}
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-star-300">🎁 ギフト履歴（全員）</h2>
                <span className="text-xs text-white/40">最新200件</span>
              </div>
              {allGifts.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">ギフト履歴がありません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/10">
                        <th className="text-left py-2 pr-3 font-medium">日時</th>
                        <th className="text-left py-2 pr-3 font-medium">会員メール</th>
                        <th className="text-left py-2 pr-3 font-medium">キャスト</th>
                        <th className="text-right py-2 font-medium">pt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allGifts.map((g) => (
                        <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-3 text-white/50 text-xs whitespace-nowrap">
                            {fmtDate(new Date(g.createdAt))}
                          </td>
                          <td className="py-2 pr-3 text-white/80 text-xs truncate max-w-[160px]">
                            {g.fromUser?.email ?? "—"}
                          </td>
                          <td className="py-2 pr-3 text-white/80 text-xs">
                            {g.cast ? (
                              <span>
                                {g.cast.name}
                                <span className="text-white/40 ml-1">({g.cast.store.name})</span>
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 text-neon-purple font-bold text-right whitespace-nowrap">
                            {g.amount.toLocaleString()} pt
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 顧客一覧 */}
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-star-300">👥 顧客一覧</h2>
                <span className="text-xs text-white/40">{customers.length}名</span>
              </div>
              {customers.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">顧客がいません</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-white/40 text-xs border-b border-white/10">
                        <th className="text-left py-2 pr-3 font-medium">メールアドレス</th>
                        <th className="text-right py-2 pr-3 font-medium">残高</th>
                        <th className="text-center py-2 pr-3 font-medium">メール</th>
                        <th className="text-left py-2 pr-3 font-medium">生年月日</th>
                        <th className="text-center py-2 pr-3 font-medium">年齢確認</th>
                        <th className="text-left py-2 font-medium">登録日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-2 pr-3 text-white/80 text-xs truncate max-w-[200px]">
                            {c.email}
                          </td>
                          <td className="py-2 pr-3 text-star-300 font-bold text-right whitespace-nowrap">
                            {c.balance.toLocaleString()} pt
                          </td>
                          <td className="py-2 pr-3 text-center">
                            {c.emailVerified ? (
                              <span className="text-green-400 text-xs">✓</span>
                            ) : (
                              <span className="text-yellow-500 text-xs">未</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-white/50 text-xs whitespace-nowrap">
                            {c.birthdate ? new Date(c.birthdate).toLocaleDateString("ja-JP") : "—"}
                          </td>
                          <td className="py-2 pr-3 text-center">
                            {c.ageVerified ? (
                              <span className="text-green-400 text-xs">✓</span>
                            ) : c.birthdate ? (
                              <span className="text-yellow-500 text-xs">未</span>
                            ) : (
                              <span className="text-white/20 text-xs">—</span>
                            )}
                          </td>
                          <td className="py-2 text-white/40 text-xs whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString("ja-JP")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-4 justify-center">
          <Link href="/ranking" className="btn-secondary text-sm">ランキングを見る</Link>
          {isAdmin && (
            <Link href="/admin" className="btn-secondary text-sm">⚙️ 管理画面</Link>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-white/40 hover:text-white/70 text-sm transition-colors">
              ログアウト
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
