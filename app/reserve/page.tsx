import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NavBar from "@/components/ui/NavBar";
import ReserveForm from "./ReserveForm";

export const dynamic = "force-dynamic";

/**
 * 席予約の入口。**予約は会員登録とログインが必須**（2026-09-12 決定・要件書 10章）。
 * 未ログインなら理由と、ログイン / 会員登録への導線を出す。
 * ログイン後に戻ってこられるよう、ログイン画面には next=/reserve を渡す。
 */
export default async function ReservePage() {
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true, name: true },
      })
    : null;

  return (
    <div className="min-h-screen star-bg">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 pt-24 pb-16">
        {user ? (
          <ReserveForm email={user.email} defaultName={user.name ?? ""} />
        ) : (
          <>
            <h1 className="text-2xl font-bold gradient-text mb-2">ご予約のお申し込み</h1>
            <div className="glass p-6 mt-6 space-y-4" data-testid="reserve-login-required">
              <p className="text-white/80 leading-relaxed">
                ご予約には会員登録（無料）とログインが必要です。
                ログインすると、予約の状況（申請中 / 予約確定）をマイページで確認でき、
                受付・確定のご連絡がメールで届きます。
              </p>
              <Link href="/auth/login?next=/reserve" className="btn-primary block text-center">
                ログインして予約する
              </Link>
              <Link href="/auth/signup" className="block text-center text-neon-purple text-sm hover:underline">
                会員登録がまだの方はこちら
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
