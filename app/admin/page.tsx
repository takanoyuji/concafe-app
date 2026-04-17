"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

interface Cast { id: string; name: string; bio: string; imageUrl: string; order: number; twitterUrl?: string | null; youtubeUrl?: string | null; streamUrl?: string | null; remoteEnabled: boolean; unmannedEnabled: boolean }
interface Title { id: string; name: string; threshold: number; order: number }
interface Customer { id: string; email: string; name: string | null; emailVerified: boolean; balance: number; createdAt: string }
interface MenuItem { id: string; category: string; name: string; price?: string | null; note?: string | null; badge?: string | null; order: number }

type Tab = "cast" | "points" | "titles" | "menu";

const MENU_CATEGORIES = [
  { value: "soft_drink",      label: "ソフトドリンク" },
  { value: "nonalc_cocktail", label: "ノンアルカクテル" },
  { value: "food",            label: "フード" },
  { value: "champagne",       label: "シャンパン" },
  { value: "cast_drink",      label: "キャストメニュー" },
];
const MENU_EMPTY = { category: "food", name: "", price: "", note: "", badge: "", order: 0 };

const CAST_EMPTY = { name: "", bio: "", imageUrl: "", order: 0, twitterUrl: "", youtubeUrl: "", streamUrl: "", remoteEnabled: false, unmannedEnabled: false };

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("cast");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuForm, setMenuForm] = useState(MENU_EMPTY);
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(""); setErr(""); }, 3000);
  };

  const fetchAll = useCallback(async () => {
    const [c, t, u, m] = await Promise.all([
      fetch("/api/cast").then(r => r.json()),
      fetch("/api/titles").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] })),
      fetch("/api/menu").then(r => r.json()).catch(() => ({ items: [] })),
    ]);
    setCasts(c.casts ?? []);
    setTitles(t.titles ?? []);
    setCustomers(u.users ?? []);
    setMenuItems(m.items ?? []);
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
    if (!castForm.bio.trim()) { flash("一言は必須です", true); return; }
    if (!castForm.imageUrl) { flash("キャスト画像をアップロードしてください", true); return; }

    const url = editingCast ? `/api/cast/${editingCast}` : "/api/cast";
    const method = editingCast ? "PUT" : "POST";
    const payload = {
      ...castForm,
      twitterUrl: castForm.twitterUrl || null,
      youtubeUrl: castForm.youtubeUrl || null,
      streamUrl: castForm.streamUrl || null,
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

  const editCast = (cast: Cast) => {
    setCastForm({
      name: cast.name, bio: cast.bio, imageUrl: cast.imageUrl,
      order: cast.order,
      twitterUrl: cast.twitterUrl ?? "",
      youtubeUrl: cast.youtubeUrl ?? "",
      streamUrl: cast.streamUrl ?? "",
      remoteEnabled: cast.remoteEnabled,
      unmannedEnabled: cast.unmannedEnabled,
    });
    setEditingCast(cast.id);
    setTab("cast");
  };

  // Grant
  const grantPoints = async (email: string) => {
    try {
      const res = await fetch("/api/points/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: grantAmount, idempotencyKey: crypto.randomUUID() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        flash(`${email} に ${grantAmount} pt を付与しました`);
        const u = await fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] }));
        setCustomers(u.users ?? []);
      } else {
        flash(typeof d.error === "string" ? d.error : "エラーが発生しました", true);
      }
    } catch {
      flash("通信エラーが発生しました", true);
    }
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

  // Menu CRUD
  const saveMenu = async () => {
    if (!menuForm.name.trim()) { flash("名前は必須です", true); return; }
    const url = editingMenu ? `/api/menu/${editingMenu}` : "/api/menu";
    const method = editingMenu ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(menuForm) });
    if (res.ok) { flash("保存しました"); setMenuForm(MENU_EMPTY); setEditingMenu(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteMenu = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const editMenu = (item: MenuItem) => {
    setMenuForm({ category: item.category, name: item.name, price: item.price ?? "", note: item.note ?? "", badge: item.badge ?? "", order: item.order });
    setEditingMenu(item.id);
    setTab("menu");
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "cast",   label: "🐺 キャスト" },
    { key: "points", label: "⭐ ポイント付与" },
    { key: "titles", label: "🏆 称号マスタ" },
    { key: "menu",   label: "🍹 メニュー" },
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
                  <label className="text-xs text-white/60 block mb-1">YouTube URL</label>
                  <input className="input-field" value={castForm.youtubeUrl} onChange={e => setCastForm(p => ({ ...p, youtubeUrl: e.target.value }))} placeholder="https://youtube.com/@..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">個別配信先 URL</label>
                  <input className="input-field" value={castForm.streamUrl} onChange={e => setCastForm(p => ({ ...p, streamUrl: e.target.value }))} placeholder="https://twitch.tv/... など" />
                </div>
                <div className="sm:col-span-2 flex gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-violet-500" checked={castForm.remoteEnabled} onChange={e => setCastForm(p => ({ ...p, remoteEnabled: e.target.checked }))} />
                    <span className="text-sm text-white/80">遠隔対応キャスト</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-violet-500" checked={castForm.unmannedEnabled} onChange={e => setCastForm(p => ({ ...p, unmannedEnabled: e.target.checked }))} />
                    <span className="text-sm text-white/80">無人営業対応キャスト</span>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  </div>
                  <button onClick={() => editCast(cast)} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                  <button onClick={() => deleteCast(cast.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                </div>
              ))}
            </div>
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
                  .filter(c => {
                    const q = customerSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      c.email.toLowerCase().includes(q) ||
                      (c.name ?? "").toLowerCase().includes(q)
                    );
                  })
                  .map(c => (
                    <div key={c.id} className="glass-dark p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{c.email}</div>
                        <div className="text-xs text-white/60 truncate">
                          ニックネーム:{" "}
                          <span className="text-white/90">{c.name?.trim() ? c.name : "（未設定）"}</span>
                        </div>
                        <div className="text-xs text-white/40">
                          残高: <span className="text-star-300">{c.balance.toLocaleString()} pt</span>
                          {!c.emailVerified && <span className="ml-2 text-yellow-500">未認証</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => grantPoints(c.email)}
                        disabled={grantAmount < 1}
                        className="btn-primary text-sm whitespace-nowrap flex-shrink-0"
                      >
                        +{grantAmount.toLocaleString()} pt
                      </button>
                    </div>
                  ))}
                {customers.filter(c => {
                  const q = customerSearch.trim().toLowerCase();
                  if (!q) return true;
                  return c.email.toLowerCase().includes(q) || (c.name ?? "").toLowerCase().includes(q);
                }).length === 0 && (
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
        {/* メニュー管理 */}
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingMenu ? "メニュー編集" : "メニュー追加"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">カテゴリ</label>
                  <select className="input-field" value={menuForm.category} onChange={e => setMenuForm(p => ({ ...p, category: e.target.value }))}>
                    {MENU_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">名前 <span className="text-neon-pink">*</span></label>
                  <input className="input-field" value={menuForm.name} onChange={e => setMenuForm(p => ({ ...p, name: e.target.value }))} placeholder="例: バニラアイス" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">価格</label>
                  <input className="input-field" value={menuForm.price} onChange={e => setMenuForm(p => ({ ...p, price: e.target.value }))} placeholder="例: ¥500" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">備考</label>
                  <input className="input-field" value={menuForm.note} onChange={e => setMenuForm(p => ({ ...p, note: e.target.value }))} placeholder="例: 匂いの弱いもの" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">バッジ <span className="text-white/30 text-xs">（シャンパンのVLL ORIGINALは「original」と入力）</span></label>
                  <input className="input-field" value={menuForm.badge} onChange={e => setMenuForm(p => ({ ...p, badge: e.target.value }))} placeholder="例: チェキつき" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={menuForm.order} onChange={e => setMenuForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveMenu} className="btn-primary text-sm">{editingMenu ? "更新" : "追加"}</button>
                {editingMenu && <button onClick={() => { setEditingMenu(null); setMenuForm(MENU_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            {MENU_CATEGORIES.map(cat => {
              const catItems = menuItems.filter(i => i.category === cat.value).sort((a, b) => a.order - b.order);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.value} className="space-y-2">
                  <h3 className="text-sm font-bold text-white/60 px-1">{cat.label}</h3>
                  {catItems.map(item => (
                    <div key={item.id} className="glass-dark p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-medium">{item.name}</span>
                        {item.price && <span className="ml-2 text-xs text-white/50">{item.price}</span>}
                        {item.note && <span className="ml-2 text-xs text-white/40">({item.note})</span>}
                        {item.badge && <span className="ml-2 text-xs text-neon-pink">[{item.badge}]</span>}
                      </div>
                      <button onClick={() => editMenu(item)} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                      <button onClick={() => deleteMenu(item.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
