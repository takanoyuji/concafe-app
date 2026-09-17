"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

/**
 * 報酬（本人のみ）。docs/cast-portal-requirements.md 4章。
 * ⚠️ この画面に 時給・労働時間・基本給・通勤手当・バック率・最低賃金 を出さない（全員業務委託）
 */
interface Half { half: 1 | 2; source: "final" | "saved" | "live" | "pending" | "none"; activity: number; salesLinked: number; total: number; note?: string }
interface Month { year: number; month: number; status: "final" | "provisional"; activity: number; salesLinked: number; total: number; halves: Half[] }

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

export default function CastRewardsPage() {
  const [data, setData] = useState<{ castName: string; months: Month[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cast/rewards")
      .then(async r => { const d = await r.json(); if (r.ok) setData(d); else setError(d.error ?? "取得に失敗しました"); })
      .catch(() => setError("通信に失敗しました"));
  }, []);

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/cast/me" className="text-white/50 text-xs hover:underline">← キャストページ</Link>
          <h1 className="text-2xl font-bold gradient-text mt-2">報酬</h1>
          <p className="text-white/60 text-xs mt-2 leading-relaxed">
            「確定」は店舗が締めた金額で、以後変わりません。「速報」は現時点の見込みで、売上や勤務の反映により変わることがあります。
            来店売上は前日分まで、遠隔は現在までを反映しています。
          </p>
        </div>

        {error && <div className="glass p-4 text-sm text-neon-pink">{error}</div>}
        {!data && !error && <div className="glass p-6 text-center text-white/50 text-sm">読み込み中...</div>}

        {data && (
          <div className="space-y-2" data-testid="reward-months">
            {data.months.map(m => {
              const key = `${m.year}-${m.month}`;
              const isOpen = open === key;
              const empty = m.halves.every(h => h.source === "none");
              const pending = m.halves.some(h => h.source === "pending");
              return (
                <div key={key} className="glass p-4">
                  <button className="w-full flex items-center justify-between text-left" onClick={() => setOpen(isOpen ? null : key)}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">{m.year}/{String(m.month).padStart(2, "0")}</span>
                      {!empty && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${m.status === "final" ? "border-green-400/50 text-green-300" : "border-amber-400/50 text-amber-200"}`}>
                          {m.status === "final" ? "確定" : "速報"}
                        </span>
                      )}
                      {pending && <span className="text-[11px] text-white/50">集計中の期間あり</span>}
                    </div>
                    <span className="font-numeric font-bold text-xl">{empty ? "—" : yen(m.total)}</span>
                  </button>
                  {!empty && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-white/60">
                      <div>稼働報酬 <span className="text-white font-numeric">{yen(m.activity)}</span></div>
                      <div>売上連動報酬 <span className="text-white font-numeric">{yen(m.salesLinked)}</span></div>
                    </div>
                  )}
                  {isOpen && (
                    <div className="mt-3 border-t border-white/10 pt-3 space-y-1 text-xs">
                      {m.halves.map(h => (
                        <div key={h.half} className="flex items-center justify-between">
                          <span className="text-white/60">
                            {h.half === 1 ? "前半（1〜15日）" : "後半（16日〜末日）"}
                            <span className="ml-2 text-white/40">
                              {h.source === "final" ? "確定" : h.source === "pending" ? (h.note ?? "集計中") : h.source === "none" ? "—" : "速報"}
                            </span>
                          </span>
                          <span className="font-numeric">{h.source === "none" || h.source === "pending" ? "—" : yen(h.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
