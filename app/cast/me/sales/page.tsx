"use client";

import Link from "next/link";
import NavBar from "@/components/ui/NavBar";
import CastSalesTable from "@/components/admin/CastSalesTable";

/** キャスト全員の月別売上（docs/cast-portal-requirements.md 6章）。報酬・率は出さない */
export default function CastSalesPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/cast/me" className="text-white/50 text-xs hover:underline">← キャストページ</Link>
          <h1 className="text-2xl font-bold gradient-text mt-2">売上一覧</h1>
        </div>
        <CastSalesTable endpoint="/api/cast/sales" />
      </main>
    </>
  );
}
