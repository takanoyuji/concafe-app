"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

interface Cast { id: string; name: string; bio: string; imageUrl: string; storeId: string; store: { name: string }; airShiftName?: string | null; rank?: string | null; exemptFromCommuteRule?: boolean }
interface Store { id: string; slug: string; name: string }
interface Title { id: string; name: string; threshold: number; order: number }
interface Customer { id: string; email: string; emailVerified: boolean; birthdate: string | null; ageVerified: boolean; balance: number; createdAt: string; name: string | null; favoriteCast1Name: string | null; favoriteCast2Name: string | null }
interface MenuItem { id: string; imageUrl: string; alt: string; order: number }
interface ResetLog { id: string; userId: string | null; email: string | null; amount: number; idempotencyKey: string | null; createdAt: string }
interface CastRank { id: string; name: string; backRate: number; order: number }
interface CastResult { castName: string; rank: string; basicPay: number; commute: number; grossProfit: number; totalSales: number; back: number; salary: number; payment: number }
interface SalarySummary { casts: CastResult[]; tc: number; totalSales: number; grossProfit: number; laborCost: number; contributionProfit: number; workHours: string }

type Tab = "cast" | "points" | "titles" | "menu" | "resets" | "salary";

const CAST_EMPTY = { name: "", bio: "", imageUrl: "", storeId: "", order: 0, twitterUrl: "", instagramUrl: "", tiktokUrl: "", airShiftName: "", rank: "", exemptFromCommuteRule: false };
const MENU_EMPTY = { imageUrl: "", alt: "", order: 0 };
const RANK_EMPTY = { name: "", backRate: 0, order: 0 };

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("cast");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [resetLogs, setResetLogs] = useState<ResetLog[]>([]);
  const [castRanks, setCastRanks] = useState<CastRank[]>([]);
  const [resetting, setResetting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Cast form
  const [castForm, setCastForm] = useState(CAST_EMPTY);
  const [editingCast, setEditingCast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Grant form
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState(100);

  // Title form
  const [titleForm, setTitleForm] = useState({ name: "", threshold: 0, order: 0 });
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  // Menu form
  const [menuForm, setMenuForm] = useState(MENU_EMPTY);
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [uploadingMenu, setUploadingMenu] = useState(false);

  // CastRank form
  const [rankForm, setRankForm] = useState(RANK_EMPTY);
  const [editingRank, setEditingRank] = useState<string | null>(null);

  // Salary form
  const [salaryStore, setSalaryStore] = useState("東京");
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [wageFile, setWageFile] = useState<File | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [salarySummary, setSalarySummary] = useState<SalarySummary | null>(null);

  // Salary sub-sections
  const [showRankMgmt, setShowRankMgmt]     = useState(false);
  const [showCastMgmt, setShowCastMgmt]     = useState(false);
  const [castMgmtStore, setCastMgmtStore]   = useState("");
  const [rankCsvFile, setRankCsvFile]       = useState<File | null>(null);
  const [castCsvFile, setCastCsvFile]       = useState<File | null>(null);
  // inline edit: castId → {airShiftName, rank}
  const [castEdits, setCastEdits] = useState<Record<string, { airShiftName: string; rank: string }>>({});

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(""); setErr(""); }, 3000);
  };

  const fetchAll = useCallback(async () => {
    const slugs = ["tokyo", "osaka", "nagoya"];
    const [c, t, u, m, resets, ranks, ...storeResults] = await Promise.all([
      fetch("/api/cast").then(r => r.json()),
      fetch("/api/titles").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] })),
      fetch("/api/menu").then(r => r.json()),
      fetch("/api/admin/monthly-reset").then(r => r.json()).catch(() => ({ resets: [] })),
      fetch("/api/admin/cast-ranks").then(r => r.json()).catch(() => ({ ranks: [] })),
      ...slugs.map(s => fetch(`/api/store/${s}`).then(r => r.json()).catch(() => ({ store: null }))),
    ]);
    setCasts(c.casts ?? []);
    setTitles(t.titles ?? []);
    setCustomers(u.users ?? []);
    setMenuItems(m.items ?? []);
    setResetLogs(resets.resets ?? []);
    setCastRanks(ranks.ranks ?? []);
    setStores(storeResults.map((r, i) => ({
      id: r.store?.id ?? "",
      slug: slugs[i],
      name: r.store?.name ?? slugs[i],
    })));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Cast CRUD
  const uploadImage = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const d = await res.json();
    if (res.ok) setCastForm(p => ({ ...p, imageUrl: d.url }));
    else flash(d.error ?? "アップロードエラー", true);
    setUploading(false);
  };

  const saveCast = async () => {
    if (!castForm.name.trim()) { flash("キャスト名は必須です", true); return; }
    if (!castForm.storeId) { flash("所属店舗を選択してください", true); return; }
    if (!castForm.bio.trim()) { flash("一言は必須です", true); return; }
    if (!castForm.imageUrl) { flash("キャスト画像をアップロードしてください", true); return; }

    const url = editingCast ? `/api/cast/${editingCast}` : "/api/cast";
    const method = editingCast ? "PUT" : "POST";
    const storeId = stores.find(s => s.slug === castForm.storeId || s.id === castForm.storeId)?.id || castForm.storeId;
    const payload = {
      ...castForm,
      storeId,
      twitterUrl: castForm.twitterUrl || null,
      instagramUrl: castForm.instagramUrl || null,
      tiktokUrl: castForm.tiktokUrl || null,
      airShiftName: castForm.airShiftName || null,
      rank: castForm.rank || null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { flash("保存しました"); setCastForm(CAST_EMPTY); setEditingCast(null); fetchAll(); }
    else {
      let errMsg = `サーバーエラー (${res.status})`;
      try { const text = await res.text(); if (text) errMsg = JSON.parse(text).error ?? errMsg; } catch {}
      flash(errMsg, true);
    }
  };

  const deleteCast = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/cast/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const editCast = (cast: Cast & { twitterUrl?: string | null; instagramUrl?: string | null; tiktokUrl?: string | null }) => {
    const storeSlug = stores.find(s => s.name === cast.store.name)?.slug ?? "";
    setCastForm({
      name: cast.name, bio: cast.bio, imageUrl: cast.imageUrl,
      storeId: storeSlug, order: 0,
      twitterUrl: cast.twitterUrl ?? "",
      instagramUrl: cast.instagramUrl ?? "",
      tiktokUrl: cast.tiktokUrl ?? "",
      airShiftName: cast.airShiftName ?? "",
      rank: cast.rank ?? "",
      exemptFromCommuteRule: cast.exemptFromCommuteRule ?? false,
    });
    setEditingCast(cast.id);
    setTab("cast");
  };

  // Grant
  const grantPoints = async (email: string) => {
    const res = await fetch("/api/points/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: grantAmount, idempotencyKey: crypto.randomUUID() }),
    });
    const d = await res.json();
    if (res.ok) {
      flash(`${email} に ${grantAmount} pt を付与しました`);
      const u = await fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] }));
      setCustomers(u.users ?? []);
    }
    else { flash(d.error ?? "エラー", true); }
  };

  // Age verification
  const verifyAge = async (id: string, ageVerified: boolean) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageVerified }),
    });
    if (res.ok) { flash(ageVerified ? "年齢確認済みにしました" : "年齢確認を取り消しました"); fetchAll(); }
    else { flash("エラーが発生しました", true); }
  };

  // Menu CRUD
  const uploadMenuImage = async (file: File) => {
    setUploadingMenu(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload-menu", { method: "POST", body: form });
    const d = await res.json();
    if (res.ok) setMenuForm(p => ({ ...p, imageUrl: d.url }));
    else flash(d.error ?? "アップロードエラー", true);
    setUploadingMenu(false);
  };

  const saveMenuItem = async () => {
    if (!menuForm.imageUrl) { flash("画像をアップロードしてください", true); return; }
    if (!menuForm.alt.trim()) { flash("説明テキストは必須です", true); return; }
    const url = editingMenu ? `/api/menu/${editingMenu}` : "/api/menu";
    const method = editingMenu ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(menuForm) });
    if (res.ok) { flash("保存しました"); setMenuForm(MENU_EMPTY); setEditingMenu(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Title CRUD
  const saveTitle = async () => {
    const url = editingTitle ? `/api/titles/${editingTitle}` : "/api/titles";
    const method = editingTitle ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(titleForm) });
    if (res.ok) { flash("保存しました"); setTitleForm({ name: "", threshold: 0, order: 0 }); setEditingTitle(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteTitle = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/titles/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Monthly reset
  const runMonthlyReset = async () => {
    if (!confirm("月次ポイントリセットを実行しますか？")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/monthly-reset", {
        method: "POST",
        headers: { "Authorization": `Bearer ${prompt("CRON_SECRETを入力してください") ?? ""}` },
      });
      const d = await res.json();
      if (res.ok) {
        flash(`リセット完了: ${d.resetCount} 件`);
        fetchAll();
      } else {
        flash(d.error ?? "エラー", true);
      }
    } finally {
      setResetting(false);
    }
  };

  // CastRank CRUD
  const saveRank = async () => {
    if (!rankForm.name.trim()) { flash("ランク名は必須です", true); return; }
    const url = editingRank ? `/api/admin/cast-ranks/${editingRank}` : "/api/admin/cast-ranks";
    const method = editingRank ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(rankForm) });
    if (res.ok) { flash("保存しました"); setRankForm(RANK_EMPTY); setEditingRank(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteRank = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/admin/cast-ranks/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Salary calculation
  const runSalaryCalc = async () => {
    if (!salesFile || !wageFile) { flash("売上CSVと人件費CSVをアップロードしてください", true); return; }
    setCalculating(true);
    setSalarySummary(null);
    try {
      const form = new FormData();
      form.append("store", salaryStore);
      form.append("salesCsv", salesFile);
      form.append("wageCsv", wageFile);
      const res = await fetch("/api/admin/salary", { method: "POST", body: form });
      const d = await res.json();
      if (res.ok) { setSalarySummary(d.summary); }
      else { flash(d.error ?? "計算エラー", true); }
    } finally {
      setCalculating(false);
    }
  };

  // CSV parse helper
  const parseCsv = (text: string) => {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { header: [], rows: [] };
    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(",");
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
    return { header, rows };
  };

  const importRanksCsv = async () => {
    if (!rankCsvFile) return;
    const text = await rankCsvFile.text();
    const { rows } = parseCsv(text);
    const ranks = rows
      .filter(r => r["ランク名"] || r["ランク"])
      .map((r, i) => ({
        name: r["ランク名"] ?? r["ランク"] ?? "",
        backRate: Number(r["バック率"] ?? "0") / (Number(r["バック率"] ?? "0") > 1 ? 100 : 1),
        order: i,
      }));
    if (ranks.length === 0) { flash("CSVにデータがありません", true); return; }
    const res = await fetch("/api/admin/cast-ranks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranks }),
    });
    if (res.ok) { flash(`${ranks.length}件のランクを登録しました`); setRankCsvFile(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const importCastMasterCsv = async () => {
    if (!castCsvFile) return;
    const text = await castCsvFile.text();
    const { rows } = parseCsv(text);
    const mapped = rows.map(r => ({
      name:         r["キャスト名"] ?? "",
      airShiftName: r["Airシフト"] ?? r["AirShift"] ?? r["airShift"] ?? "",
      rank:         r["ランク"] ?? "",
    })).filter(r => r.name);
    if (mapped.length === 0) { flash("CSVにデータがありません", true); return; }
    const res = await fetch("/api/admin/cast/bulk-salary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: mapped }),
    });
    if (res.ok) { const d = await res.json(); flash(`${d.updated}件を更新しました`); setCastCsvFile(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const saveCastSalaryField = async (castId: string) => {
    const edit = castEdits[castId];
    if (!edit) return;
    const res = await fetch(`/api/cast/${castId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (res.ok) { flash("保存しました"); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "cast",       label: "🐺 キャスト" },
    { key: "salary",     label: "💴 給与計算" },
    { key: "points",     label: "⭐ ポイント付与" },
    { key: "titles",     label: "🏆 称号マスタ" },
    { key: "menu",       label: "🍽️ メニュー" },
    { key: "resets",     label: "🔄 リセット履歴" },
  ];

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center">
          ⚙️ 管理画面
        </h1>

        {msg && <div className="glass p-4 text-green-400 text-center">{msg}</div>}
        {err && <div className="glass p-4 text-neon-pink text-center">{err}</div>}

        {/* タブ */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                tab === key ? "bg-neon-violet text-white" : "glass text-white/60 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <Link href="/me" className="ml-auto text-white/40 hover:text-white/70 text-sm self-center">
            マイページ →
          </Link>
        </div>

        {/* キャスト管理 */}
        {tab === "cast" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingCast ? "キャスト編集" : "キャスト追加"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">名前 <span className="text-neon-pink">*</span></label>
                  <input className="input-field" value={castForm.name} onChange={e => setCastForm(p => ({ ...p, name: e.target.value }))} placeholder="キャスト名" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">所属店舗 <span className="text-neon-pink">*</span></label>
                  <select className="input-field" value={castForm.storeId} onChange={e => setCastForm(p => ({ ...p, storeId: e.target.value }))}>
                    <option value="">選択してください</option>
                    {stores.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60 block mb-1">一言 <span className="text-neon-pink">*</span></label>
                  <textarea className="input-field min-h-[80px]" value={castForm.bio} onChange={e => setCastForm(p => ({ ...p, bio: e.target.value }))} placeholder="一言を入力（例：みんなを笑顔にします！）" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60 block mb-1">キャスト画像 <span className="text-neon-pink">*</span></label>
                  <div className="flex gap-3 items-start">
                    {castForm.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={castForm.imageUrl} alt="プレビュー" className="w-16 h-20 object-cover rounded-lg border border-white/20 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed cursor-pointer transition-all ${uploading ? "border-white/20 text-white/30" : "border-neon-violet text-neon-violet hover:bg-neon-violet/10"}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-sm">{uploading ? "アップロード中..." : "画像を選択"}</span>
                        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                      </label>
                      <input className="input-field text-xs" value={castForm.imageUrl} onChange={e => setCastForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="または画像URLを直接入力" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={castForm.order} onChange={e => setCastForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">X (Twitter) URL</label>
                  <input className="input-field" value={castForm.twitterUrl} onChange={e => setCastForm(p => ({ ...p, twitterUrl: e.target.value }))} placeholder="https://x.com/@..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">Instagram URL</label>
                  <input className="input-field" value={castForm.instagramUrl} onChange={e => setCastForm(p => ({ ...p, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">TikTok URL</label>
                  <input className="input-field" value={castForm.tiktokUrl} onChange={e => setCastForm(p => ({ ...p, tiktokUrl: e.target.value }))} placeholder="https://tiktok.com/@..." />
                </div>
                {/* 給与計算用フィールド */}
                <div>
                  <label className="text-xs text-white/60 block mb-1">AirShift氏名（給与計算用）</label>
                  <input className="input-field" value={castForm.airShiftName} onChange={e => setCastForm(p => ({ ...p, airShiftName: e.target.value }))} placeholder="勤怠CSVの氏名と一致させてください" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">ランク</label>
                  <select className="input-field" value={castForm.rank} onChange={e => setCastForm(p => ({ ...p, rank: e.target.value }))}>
                    <option value="">未設定</option>
                    {castRanks.map(r => <option key={r.id} value={r.name}>{r.name}（バック率 {(r.backRate * 100).toFixed(0)}%）</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="exemptFromCommuteRule"
                    checked={castForm.exemptFromCommuteRule}
                    onChange={e => setCastForm(p => ({ ...p, exemptFromCommuteRule: e.target.checked }))}
                    className="w-4 h-4 accent-neon-violet"
                  />
                  <label htmlFor="exemptFromCommuteRule" className="text-xs text-white/60 cursor-pointer">
                    通勤手当0ルール除外（ゴールド以上でも通勤手当を支給する）
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveCast} disabled={uploading} className="btn-primary text-sm">{editingCast ? "更新" : "追加"}</button>
                {editingCast && <button onClick={() => { setEditingCast(null); setCastForm(CAST_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            <div className="space-y-2">
              {casts.map(cast => (
                <div key={cast.id} className="glass-dark p-3 flex items-center gap-4">
                  {cast.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cast.imageUrl}
                      alt={cast.name}
                      className="w-12 h-14 object-cover rounded-lg flex-shrink-0 bg-white/5"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-12 h-14 rounded-lg flex-shrink-0 bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center text-xl">🐺</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{cast.name}</div>
                    <div className="text-xs text-white/40">{cast.store.name}{cast.rank ? ` · ${cast.rank}` : ""}</div>
                  </div>
                  <button onClick={() => editCast(cast)} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                  <button onClick={() => deleteCast(cast.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 給与計算 */}
        {tab === "salary" && (
          <div className="space-y-6">

            {/* キャストランク管理 */}
            <div className="glass p-4">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowRankMgmt(p => !p)}
              >
                <span className="font-bold text-star-300">🏅 キャストランク管理</span>
                <span className="text-white/40 text-sm">{showRankMgmt ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showRankMgmt && (
                <div className="mt-4 space-y-4">
                  {/* CSV インポート */}
                  <div className="glass-dark p-4 space-y-2">
                    <p className="text-xs text-white/50">CSVインポート（ヘッダー: <code>ランク名,バック率</code>、バック率は%で入力）</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file" accept=".csv"
                        className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer flex-1"
                        onChange={e => setRankCsvFile(e.target.files?.[0] ?? null)}
                      />
                      <button onClick={importRanksCsv} disabled={!rankCsvFile} className="btn-primary text-sm whitespace-nowrap">インポート</button>
                    </div>
                  </div>
                  {/* 手動追加フォーム */}
                  <div className="space-y-3">
                    <p className="text-xs text-white/50 font-bold">{editingRank ? "ランク編集" : "手動追加"}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-white/60 block mb-1">ランク名 <span className="text-neon-pink">*</span></label>
                        <input className="input-field" value={rankForm.name} onChange={e => setRankForm(p => ({ ...p, name: e.target.value }))} placeholder="例: ゴールド" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">バック率（%） <span className="text-neon-pink">*</span></label>
                        <input type="number" className="input-field" value={Math.round(rankForm.backRate * 100)} onChange={e => setRankForm(p => ({ ...p, backRate: Number(e.target.value) / 100 }))} min={0} max={100} step={1} placeholder="例: 50" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">表示順</label>
                        <input type="number" className="input-field" value={rankForm.order} onChange={e => setRankForm(p => ({ ...p, order: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={saveRank} className="btn-primary text-sm">{editingRank ? "更新" : "追加"}</button>
                      {editingRank && <button onClick={() => { setEditingRank(null); setRankForm(RANK_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
                    </div>
                  </div>
                  {/* 一覧 */}
                  <div className="space-y-2">
                    {castRanks.map(r => (
                      <div key={r.id} className="glass-dark p-3 flex items-center gap-4">
                        <div className="flex-1">
                          <span className="font-bold text-white">{r.name}</span>
                          <span className="text-xs text-white/40 ml-3">バック率: {(r.backRate * 100).toFixed(0)}%　順番: {r.order}</span>
                        </div>
                        <button onClick={() => { setRankForm({ name: r.name, backRate: r.backRate, order: r.order }); setEditingRank(r.id); }} className="text-neon-violet text-sm hover:text-neon-purple">編集</button>
                        <button onClick={() => deleteRank(r.id)} className="text-neon-pink text-sm hover:text-red-400">削除</button>
                      </div>
                    ))}
                    {castRanks.length === 0 && <p className="text-white/40 text-sm text-center py-4">ランクが登録されていません</p>}
                  </div>
                </div>
              )}
            </div>

            {/* キャストマスタ管理 */}
            <div className="glass p-4">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowCastMgmt(p => !p)}
              >
                <span className="font-bold text-star-300">👥 キャストマスタ管理</span>
                <span className="text-white/40 text-sm">{showCastMgmt ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showCastMgmt && (
                <div className="mt-4 space-y-4">
                  {/* CSV インポート */}
                  <div className="glass-dark p-4 space-y-2">
                    <p className="text-xs text-white/50">CSVインポート（ヘッダー: <code>キャスト名,Airシフト,ランク</code>）</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file" accept=".csv"
                        className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer flex-1"
                        onChange={e => setCastCsvFile(e.target.files?.[0] ?? null)}
                      />
                      <button onClick={importCastMasterCsv} disabled={!castCsvFile} className="btn-primary text-sm whitespace-nowrap">インポート</button>
                    </div>
                  </div>
                  {/* 店舗フィルター */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setCastMgmtStore("")} className={`px-3 py-1 rounded-full text-sm border transition-all ${castMgmtStore === "" ? "border-neon-violet text-neon-violet" : "border-white/20 text-white/60"}`}>全店舗</button>
                    {stores.map(s => (
                      <button key={s.id} onClick={() => setCastMgmtStore(s.name)} className={`px-3 py-1 rounded-full text-sm border transition-all ${castMgmtStore === s.name ? "border-neon-violet text-neon-violet" : "border-white/20 text-white/60"}`}>{s.name}</button>
                    ))}
                  </div>
                  {/* キャスト一覧 (inline edit) */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 text-xs border-b border-white/10">
                          <th className="text-left pb-2">キャスト名</th>
                          <th className="text-left pb-2">店舗</th>
                          <th className="text-left pb-2">Airシフト氏名</th>
                          <th className="text-left pb-2">ランク</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {casts
                          .filter(c => !castMgmtStore || c.store.name === castMgmtStore)
                          .map(c => {
                            const edit = castEdits[c.id] ?? { airShiftName: c.airShiftName ?? "", rank: c.rank ?? "" };
                            return (
                              <tr key={c.id} className="border-b border-white/5">
                                <td className="py-2 font-medium text-white">{c.name}</td>
                                <td className="py-2 text-white/50 text-xs">{c.store.name}</td>
                                <td className="py-2">
                                  <input
                                    className="input-field text-xs py-1 px-2 w-32"
                                    value={edit.airShiftName}
                                    onChange={e => setCastEdits(p => ({ ...p, [c.id]: { ...edit, airShiftName: e.target.value } }))}
                                  />
                                </td>
                                <td className="py-2">
                                  <select
                                    className="input-field text-xs py-1 px-2 w-28"
                                    value={edit.rank}
                                    onChange={e => setCastEdits(p => ({ ...p, [c.id]: { ...edit, rank: e.target.value } }))}
                                  >
                                    <option value="">-- 未設定 --</option>
                                    {castRanks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                  </select>
                                </td>
                                <td className="py-2">
                                  <button onClick={() => saveCastSalaryField(c.id)} className="text-neon-violet text-xs hover:text-neon-purple">保存</button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 給与計算フォーム */}
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">給与計算</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">店舗</label>
                  <select className="input-field" value={salaryStore} onChange={e => setSalaryStore(e.target.value)}>
                    {stores.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">売上CSV（Shift-JIS）<span className="text-neon-pink"> *</span></label>
                  <input
                    type="file"
                    accept=".csv"
                    className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer"
                    onChange={e => setSalesFile(e.target.files?.[0] ?? null)}
                  />
                  {salesFile && <p className="text-xs text-white/40 mt-1">{salesFile.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">人件費CSV（UTF-8）<span className="text-neon-pink"> *</span></label>
                  <input
                    type="file"
                    accept=".csv"
                    className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer"
                    onChange={e => setWageFile(e.target.files?.[0] ?? null)}
                  />
                  {wageFile && <p className="text-xs text-white/40 mt-1">{wageFile.name}</p>}
                </div>
              </div>
              <button
                onClick={runSalaryCalc}
                disabled={calculating || !salesFile || !wageFile}
                className="btn-primary"
              >
                {calculating ? "計算中..." : "計算実行"}
              </button>
            </div>

            {salarySummary && (
              <>
                {/* 業績サマリー */}
                <div className="glass p-6 space-y-3">
                  <h2 className="font-bold text-star-300">業績サマリー</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    {[
                      { label: "客数 (TC)", value: salarySummary.tc.toFixed(1) },
                      { label: "総売上", value: `¥${salarySummary.totalSales.toLocaleString()}` },
                      { label: "売上総利益", value: `¥${Math.round(salarySummary.grossProfit).toLocaleString()}` },
                      { label: "人件費", value: `¥${salarySummary.laborCost.toLocaleString()}` },
                      { label: "貢献利益", value: `¥${Math.round(salarySummary.contributionProfit).toLocaleString()}` },
                      { label: "総労働時間", value: salarySummary.workHours },
                    ].map(({ label, value }) => (
                      <div key={label} className="glass-dark p-3 rounded-lg">
                        <div className="text-xs text-white/50">{label}</div>
                        <div className="font-bold text-white mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* キャスト別支払額 */}
                <div className="glass p-6 space-y-3">
                  <h2 className="font-bold text-star-300">キャスト別支払額</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 text-xs border-b border-white/10">
                          <th className="text-left pb-2">キャスト名</th>
                          <th className="text-right pb-2">基本給</th>
                          <th className="text-right pb-2">通勤手当</th>
                          <th className="text-right pb-2">バック</th>
                          <th className="text-right pb-2">支払額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salarySummary.casts
                          .sort((a, b) => b.payment - a.payment)
                          .map(c => (
                          <tr key={c.castName} className="border-b border-white/5">
                            <td className="py-2">
                              <div className="font-medium text-white">{c.castName}</div>
                              <div className="text-xs text-white/40">{c.rank}</div>
                            </td>
                            <td className="text-right text-white/70">¥{c.basicPay.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{c.commute.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{Math.round(c.back).toLocaleString()}</td>
                            <td className="text-right font-bold text-star-300">¥{c.payment.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/20">
                          <td className="pt-2 font-bold text-white" colSpan={4}>合計</td>
                          <td className="pt-2 text-right font-bold text-neon-violet">
                            ¥{salarySummary.casts.reduce((a, c) => a + c.payment, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 売上詳細 */}
                <div className="glass p-6 space-y-3">
                  <h2 className="font-bold text-star-300">キャスト別売上・粗利</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 text-xs border-b border-white/10">
                          <th className="text-left pb-2">キャスト名</th>
                          <th className="text-right pb-2">総売上</th>
                          <th className="text-right pb-2">粗利</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salarySummary.casts
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .map(c => (
                          <tr key={c.castName} className="border-b border-white/5">
                            <td className="py-2 font-medium text-white">{c.castName}</td>
                            <td className="text-right text-white/70">¥{c.totalSales.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{Math.round(c.grossProfit).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ポイント付与 */}
        {tab === "points" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">付与ポイント数を選択</h2>
              <div className="flex gap-2 flex-wrap mb-2">
                {[100, 500, 1000, 3000].map(v => (
                  <button key={v} onClick={() => setGrantAmount(v)} className={`px-3 py-1 rounded-full text-sm border transition-all ${grantAmount === v ? "border-neon-purple text-neon-purple" : "border-white/20 text-white/60"}`}>
                    {v.toLocaleString()} pt
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">カスタム数量</label>
                <input type="number" className="input-field" value={grantAmount} onChange={e => setGrantAmount(Number(e.target.value))} min={1} />
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">会員一覧（クリックで付与）</h2>
              <div>
                <input
                  className="input-field"
                  placeholder="メール・ニックネームで絞り込み..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers
                  .filter(c => c.email.includes(customerSearch) || (c.name ?? "").includes(customerSearch))
                  .map(c => (
                    <div key={c.id} className="glass-dark p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{c.email}</div>
                        {c.name && <div className="text-xs text-neon-violet truncate">ニック: {c.name}</div>}
                        {(c.favoriteCast1Name || c.favoriteCast2Name) && (
                          <div className="text-xs text-white/60 truncate">
                            推し: {[c.favoriteCast1Name, c.favoriteCast2Name].filter(Boolean).join(" / ")}
                          </div>
                        )}
                        <div className="text-xs text-white/40 flex flex-wrap gap-2 mt-0.5">
                          <span>残高: <span className="text-star-300">{c.balance.toLocaleString()} pt</span></span>
                          {c.birthdate && (
                            <span>生年月日: <span className="text-white/60">{new Date(c.birthdate).toLocaleDateString("ja-JP")}</span></span>
                          )}
                          {!c.emailVerified && <span className="text-yellow-500">メール未認証</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.birthdate && (
                          c.ageVerified ? (
                            <button onClick={() => verifyAge(c.id, false)} className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 transition-all whitespace-nowrap">
                              ✓ 年齢確認済
                            </button>
                          ) : (
                            <button onClick={() => verifyAge(c.id, true)} className="text-xs px-2 py-1 rounded-full border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 transition-all whitespace-nowrap">
                              年齢確認する
                            </button>
                          )
                        )}
                        <button
                          onClick={() => grantPoints(c.email)}
                          disabled={grantAmount < 1}
                          className="btn-primary text-sm whitespace-nowrap"
                        >
                          +{grantAmount.toLocaleString()} pt
                        </button>
                      </div>
                    </div>
                  ))}
                {customers.filter(c => c.email.includes(customerSearch)).length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">会員が見つかりません</p>
                )}
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">メールアドレスで直接付与</h2>
              <div>
                <label className="text-xs text-white/60 block mb-1">メールアドレス</label>
                <input
                  className="input-field"
                  value={grantEmail}
                  onChange={e => setGrantEmail(e.target.value)}
                  placeholder="customer@example.com"
                  type="email"
                />
              </div>
              <button
                onClick={() => { grantPoints(grantEmail); setGrantEmail(""); }}
                disabled={!grantEmail || grantAmount < 1}
                className="btn-primary"
              >
                {grantAmount.toLocaleString()} pt を付与する
              </button>
            </div>
          </div>
        )}

        {/* メニュー管理 */}
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingMenu ? "メニュー画像編集" : "メニュー画像追加"}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">画像 <span className="text-neon-pink">*</span></label>
                  <div className="flex gap-3 items-start">
                    {menuForm.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={menuForm.imageUrl} alt="プレビュー" className="w-16 h-20 object-cover rounded-lg border border-white/20 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed cursor-pointer transition-all ${uploadingMenu ? "border-white/20 text-white/30" : "border-neon-violet text-neon-violet hover:bg-neon-violet/10"}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-sm">{uploadingMenu ? "アップロード中..." : "画像を選択"}</span>
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingMenu} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuImage(f); }} />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 block mb-1">説明テキスト（alt） <span className="text-neon-pink">*</span></label>
                    <input className="input-field" value={menuForm.alt} onChange={e => setMenuForm(p => ({ ...p, alt: e.target.value }))} placeholder="例: フードメニュー 1" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 block mb-1">表示順</label>
                    <input type="number" className="input-field" value={menuForm.order} onChange={e => setMenuForm(p => ({ ...p, order: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveMenuItem} disabled={uploadingMenu} className="btn-primary text-sm">{editingMenu ? "更新" : "追加"}</button>
                {editingMenu && <button onClick={() => { setEditingMenu(null); setMenuForm(MENU_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            <div className="space-y-2">
              {menuItems.map((item, i) => (
                <div key={item.id} className="glass-dark p-3 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.alt} className="w-12 h-14 object-cover rounded-lg flex-shrink-0 bg-white/5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{item.alt}</div>
                    <div className="text-xs text-white/40">順番: {item.order}（{i + 1}/{menuItems.length}）</div>
                  </div>
                  <button onClick={() => { setMenuForm({ imageUrl: item.imageUrl, alt: item.alt, order: item.order }); setEditingMenu(item.id); setTab("menu"); }} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                  <button onClick={() => deleteMenuItem(item.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* リセット履歴 */}
        {tab === "resets" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-star-300">月次ポイントリセット履歴</h2>
                <button
                  onClick={runMonthlyReset}
                  disabled={resetting}
                  className="btn-primary text-sm"
                >
                  {resetting ? "実行中..." : "手動リセット実行"}
                </button>
              </div>
              <p className="text-xs text-white/40">毎月1日午前5時にcronで自動実行されます。テスト用に手動実行もできます。</p>
            </div>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto">
              {resetLogs.length === 0 && (
                <p className="text-white/40 text-sm text-center py-8">リセット履歴がありません</p>
              )}
              {resetLogs.map(r => (
                <div key={r.id} className="glass-dark p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{r.email ?? r.userId}</div>
                    <div className="text-xs text-white/40">{new Date(r.createdAt).toLocaleString("ja-JP")}</div>
                  </div>
                  <div className="text-neon-pink text-sm font-bold flex-shrink-0">-{r.amount.toLocaleString()} pt</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 称号マスタ */}
        {tab === "titles" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingTitle ? "称号編集" : "称号追加"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">称号名</label>
                  <input className="input-field" value={titleForm.name} onChange={e => setTitleForm(p => ({ ...p, name: e.target.value }))} placeholder="称号名" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">閾値（累計GIFTポイント）</label>
                  <input type="number" className="input-field" value={titleForm.threshold} onChange={e => setTitleForm(p => ({ ...p, threshold: Number(e.target.value) }))} min={0} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={titleForm.order} onChange={e => setTitleForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveTitle} className="btn-primary text-sm">{editingTitle ? "更新" : "追加"}</button>
                {editingTitle && <button onClick={() => { setEditingTitle(null); setTitleForm({ name: "", threshold: 0, order: 0 }); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>
            <div className="space-y-2">
              {titles.map(t => (
                <div key={t.id} className="glass-dark p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.threshold.toLocaleString()} pt〜</div>
                  </div>
                  <button onClick={() => { setTitleForm({ name: t.name, threshold: t.threshold, order: t.order }); setEditingTitle(t.id); }} className="text-neon-violet text-sm hover:text-neon-purple">編集</button>
                  <button onClick={() => deleteTitle(t.id)} className="text-neon-pink text-sm hover:text-red-400">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
