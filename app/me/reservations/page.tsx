import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_STATUS_LABEL,
  customerReservationWhere,
  type ReservationStatus,
} from "@/lib/reservation";
import NavBar from "@/components/ui/NavBar";

export const dynamic = "force-dynamic";

/**
 * 会員の「ご予約」一覧（要件書 10章・2026-09-12）。
 *
 * ログインした会員だけが見られる。出すのは自分の予約（ログイン中に申し込んだもの、または
 * メール認証済みならメールアドレスが一致するもの）。過去分も含めて来店日の新しい順。
 * 状態の言葉はお客様向けの4つ（CUSTOMER_STATUS_LABEL）。台帳の6つは見せない。
 * 変更・キャンセルはここからはできない（公式LINEで受ける）。
 */
export default async function MyReservationsPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) redirect("/auth/login");

  const rows = await prisma.reservation.findMany({
    where: customerReservationWhere(user),
    include: { store: { select: { name: true } } },
    orderBy: [{ visitDate: "desc" }, { visitTime: "desc" }],
    take: 100,
  });

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-xl mx-auto space-y-6">
        <div>
          <Link href="/me" className="text-white/50 text-xs hover:underline">← マイページ</Link>
          <h1 className="text-2xl font-bold gradient-text mt-2">ご予約</h1>
        </div>

        {!user.emailVerified && (
          <p className="text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2 leading-relaxed">
            メールアドレスが未認証のため、ログインせずにお申し込みいただいた分は表示されません。
            認証が済むと、同じメールアドレスの予約もここに並びます。
          </p>
        )}

        {rows.length === 0 ? (
          <div className="glass p-6 text-center space-y-3">
            <p className="text-white/70">ご予約はまだありません。</p>
            <Link href="/reserve" className="btn-primary inline-block">席を予約する</Link>
          </div>
        ) : (
          <ul className="space-y-3" data-testid="my-reservations">
            {rows.map(r => {
              const status = r.status as ReservationStatus;
              return (
                <li key={r.id} className="glass p-4" data-status={status}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{r.visitDate} {r.visitTime}</span>
                    <StatusBadge status={status} />
                  </div>
                  <p className="text-white/70 text-sm mt-1">
                    {r.store?.name ?? ""} / {r.partySize}名 / {r.customerName} 様
                  </p>
                  {status === "PENDING" && (
                    <p className="text-white/50 text-xs mt-2">
                      店舗が内容を確認中です。確定 / 満席のご連絡はメールと公式LINEでお送りします。
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-white/50 text-xs leading-relaxed">
          ご来店時間の変更・キャンセルは公式LINEのトークからご連絡ください。
        </p>
        <Link href="/reserve" className="text-neon-purple text-sm hover:underline">
          新しく予約する →
        </Link>
      </main>
    </>
  );
}

const BADGE: Record<ReservationStatus, string> = {
  PENDING:   "bg-yellow-500/80 text-black",
  CONFIRMED: "bg-green-500/80 text-black",
  DECLINED:  "bg-white/20 text-white/80",
  CANCELED:  "bg-white/20 text-white/80",
  // 来店済み・無断キャンセルは「予約確定」のまま見せる（店舗の内部記録なので）
  VISITED:   "bg-green-500/80 text-black",
  NO_SHOW:   "bg-green-500/80 text-black",
};

function StatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${BADGE[status]}`}>
      {CUSTOMER_STATUS_LABEL[status]}
    </span>
  );
}
