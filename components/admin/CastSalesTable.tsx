"use client";

import { useEffect, useState } from "react";

/**
 * キャスト別の月次売上（来店 / 遠隔 / 合計）。キャストページと管理画面で共用。
 * endpoint はどちらも同じ形の JSON を返す（/api/cast/sales, /api/admin/sales/casts）。報酬・率は含まない
 */
interface Row { castCode: string; name: string; local: number; remote: number; total: number }
interface Resp { year: number; month: number; rows: Row[]; asOf: { airRegi: string; remodri: string }; myCastCode: string | null }

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

export function monthOptions(): { year: number; month: number }[] {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  const out = [];
  for (let i = 0; i < 13; i++) { out.push({ year: y, month: m }); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

export default function CastSalesTable({ endpoint }: { endpoint: string }) {
  const options = monthOptions();
  const [sel, setSel] = useState(options[0]);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${endpoint}?year=${sel.year}&month=${sel.month}`)
      .then(async r => { const d = await r.json(); if (!alive) return; if (r.ok) { setData(d); setError(null); } else setError(d.error ?? "取得に失敗しました"); })
      .catch(() => { if (alive) setError("通信に失敗しました"); });
    return () => { alive = false; };
  }, [endpoint, sel]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select className="input-field w-40" value={`${sel.year}-${sel.month}`}
          onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setSel({ year: y, month: m }); }}>
          {options.map(o => <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.year}/{String(o.month).padStart(2, "0")}</option>)}
        </select>
        {data && <span className="text-xs text-white/50">来店は {data.asOf.airRegi} まで / 遠隔は{data.asOf.remodri}まで（税込）</span>}
      </div>

      {error && <div className="glass p-4 text-sm text-neon-pink">{error}</div>}
      {!data && !error && <div className="glass p-6 text-center text-white/50 text-sm">読み込み中...</div>}

      {data && (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm" data-testid="cast-sales-table">
            <thead>
              <tr className="text-white/50 text-xs border-b border-white/10">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">キャスト</th>
                <th className="text-right px-3 py-2">来店</th>
                <th className="text-right px-3 py-2">遠隔</th>
                <th className="text-right px-3 py-2">合計</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr key={r.castCode} className={`border-b border-white/5 ${r.castCode === data.myCastCode ? "bg-neon-violet/15" : ""}`}>
                  <td className="px-3 py-2 text-white/40">{i + 1}</td>
                  <td className="px-3 py-2 font-bold">{r.name}{r.castCode === data.myCastCode && <span className="ml-1 text-[10px] text-neon-violet">自分</span>}</td>
                  <td className="px-3 py-2 text-right font-numeric">{yen(r.local)}</td>
                  <td className="px-3 py-2 text-right font-numeric">{yen(r.remote)}</td>
                  <td className="px-3 py-2 text-right font-numeric font-bold">{yen(r.total)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-white/40">データがありません</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
