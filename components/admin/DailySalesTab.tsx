"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

/**
 * 管理画面「売上」タブ。店舗×月の日次売上（来店 / 遠隔）を表と積み上げ棒で出す。
 * docs/cast-portal-requirements.md 7章。遠隔は「キャストの所属店舗」基準（伝票が立った店舗ではない）
 */
interface Row { businessDate: string; local: number; remote: number; total: number; airRegiMissing: boolean }
interface Resp { store: string; year: number; month: number; rows: Row[]; total: { local: number; remote: number; total: number }; remodriError: string | null }

const STORES = [{ key: "tokyo", label: "東京" }, { key: "osaka", label: "大阪" }, { key: "nagoya", label: "名古屋" }];
const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

function monthOptions() {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  const out = [];
  for (let i = 0; i < 13; i++) { out.push({ year: y, month: m }); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

export default function DailySalesTab() {
  const options = monthOptions();
  const [store, setStore] = useState("tokyo");
  const [sel, setSel] = useState(options[0]);
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/sales/daily?store=${store}&year=${sel.year}&month=${sel.month}`)
      .then(async r => { const d = await r.json(); if (!alive) return; if (r.ok) { setData(d); setError(null); } else setError(d.error ?? "取得に失敗しました"); })
      .catch(() => { if (alive) setError("通信に失敗しました"); });
    return () => { alive = false; };
  }, [store, sel]);

  const chartData = (data?.rows ?? []).map(r => ({ day: r.businessDate.slice(8), 来店: r.local, 遠隔: r.remote }));

  return (
    <div className="space-y-4" data-testid="daily-sales-tab">
      <div className="glass p-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {STORES.map(s => (
            <button key={s.key} onClick={() => setStore(s.key)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${store === s.key ? "border-neon-violet bg-neon-violet/20 text-neon-violet" : "border-white/20 text-white/60 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <select className="input-field w-36" value={`${sel.year}-${sel.month}`}
          onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setSel({ year: y, month: m }); }}>
          {options.map(o => <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.year}/{String(o.month).padStart(2, "0")}</option>)}
        </select>
        <span className="text-xs text-white/40">来店＝Airレジの伝票合計（前日まで・赤伝はマイナス）／遠隔＝remodri（キャストの所属店舗基準）。いずれも税込</span>
      </div>

      {error && <div className="glass p-4 text-sm text-neon-pink">{error}</div>}
      {!data && !error && <div className="glass p-6 text-center text-white/50 text-sm">読み込み中...</div>}

      {data && (
        <>
          {data.remodriError && <div className="glass p-3 text-xs text-amber-200 border border-amber-400/40">遠隔売上を取得できませんでした: {data.remodriError}（来店だけ表示しています）</div>}
          <div className="glass p-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-white/50">来店</p><p className="font-numeric font-bold text-lg">{yen(data.total.local)}</p></div>
            <div><p className="text-xs text-white/50">遠隔</p><p className="font-numeric font-bold text-lg">{yen(data.total.remote)}</p></div>
            <div><p className="text-xs text-white/50">合計</p><p className="font-numeric font-bold text-lg text-star-300">{yen(data.total.total)}</p></div>
          </div>

          <div className="glass p-4" data-testid="daily-sales-chart">
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} tickFormatter={v => `${Math.round(Number(v) / 10000)}万`} width={40} />
                  <Tooltip formatter={(v) => yen(Number(v))} labelFormatter={l => `${data.month}/${l}`} contentStyle={{ background: "#1a1033", border: "1px solid rgba(255,255,255,0.15)", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="来店" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="遠隔" stackId="a" fill="#f472b6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass overflow-x-auto">
            <table className="w-full text-sm" data-testid="daily-sales-table">
              <thead>
                <tr className="text-white/50 text-xs border-b border-white/10">
                  <th className="text-left px-3 py-2">営業日</th>
                  <th className="text-right px-3 py-2">来店</th>
                  <th className="text-right px-3 py-2">遠隔</th>
                  <th className="text-right px-3 py-2">合計</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.businessDate} className="border-b border-white/5">
                    <td className="px-3 py-1.5 font-numeric">
                      {r.businessDate.slice(5).replace("-", "/")}
                      {r.airRegiMissing && <span className="ml-2 text-[10px] text-amber-300" title="Airレジの取り込みがありません">未取込</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-numeric">{yen(r.local)}</td>
                    <td className="px-3 py-1.5 text-right font-numeric">{yen(r.remote)}</td>
                    <td className="px-3 py-1.5 text-right font-numeric font-bold">{yen(r.total)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-white/40">この月のデータはまだありません</td></tr>}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/20 font-bold">
                  <td className="px-3 py-2">月計</td>
                  <td className="px-3 py-2 text-right font-numeric">{yen(data.total.local)}</td>
                  <td className="px-3 py-2 text-right font-numeric">{yen(data.total.remote)}</td>
                  <td className="px-3 py-2 text-right font-numeric text-star-300">{yen(data.total.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
