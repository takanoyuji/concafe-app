import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCastByUserId } from "@/lib/castPortal";
import NavBar from "@/components/ui/NavBar";

export const dynamic = "force-dynamic";

/** キャストポータルのホーム（docs/cast-portal-requirements.md 8章）。客向けの機能は出さない */
export default async function CastMePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role !== "CAST") redirect("/");
  const cast = await getCastByUserId(session.userId);

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-xl mx-auto space-y-6">
        <div>
          <p className="text-white/50 text-xs">キャストページ</p>
          <h1 className="text-2xl font-bold gradient-text mt-1">{cast?.name ?? "—"}</h1>
          {cast?.stores[0] && <p className="text-white/60 text-sm mt-1">所属: {cast.stores[0].store.name}</p>}
        </div>

        {!cast ? (
          <div className="glass p-6 text-sm text-neon-pink">キャスト情報が結ばれていません。店舗の担当者に連絡してください。</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/cast/me/rewards" className="glass p-5 hover:bg-white/5 transition-colors block">
              <p className="text-lg font-bold">報酬</p>
              <p className="text-white/60 text-sm mt-1">月ごとの報酬（確定前は速報）</p>
            </Link>
            <Link href="/cast/me/sales" className="glass p-5 hover:bg-white/5 transition-colors block">
              <p className="text-lg font-bold">売上一覧</p>
              <p className="text-white/60 text-sm mt-1">キャストごとの月別売上（来店 / 遠隔）</p>
            </Link>
          </div>
        )}

        <p className="text-white/40 text-xs">ログアウトは上部のメニューから。</p>
      </main>
    </>
  );
}
