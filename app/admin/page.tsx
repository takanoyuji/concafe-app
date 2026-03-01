"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

interface Cast { id: string; name: string; bio: string; imageUrl: string; storeId: string; store: { name: string } }
interface Store { id: string; slug: string; name: string }
interface Title { id: string; name: string; threshold: number; order: number }
interface Customer { id: string; email: string; emailVerified: boolean; balance: number; createdAt: string }

type Tab = "cast" | "points" | "titles";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("cast");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Cast form
  const [castForm, setCastForm] = useState({ name: "", bio: "", imageUrl: "/images/cast-placeholder.jpg", storeId: "", order: 0 });
  const [editingCast, setEditingCast] = useState<string | null>(null);

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
    const [c, s, t, u] = await Promise.all([
      fetch("/api/cast").then(r => r.json()),
      fetch("/api/store/tokyo").then(r => r.json()).catch(() => ({ store: null })),
      fetch("/api/titles").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] })),
    ]);
    setCasts(c.casts ?? []);
    setTitles(t.titles ?? []);
    setCustomers(u.users ?? []);
    // storesはseed済みのため固定
    setStores([
      { id: "", slug: "tokyo", name: "星狼 池袋店" },
      { id: "", slug: "osaka", name: "星狼 日本橋店" },
      { id: "", slug: "nagoya", name: "星狼 名古屋錦店" },
    ]);
    void c; void s; void t;
  }, []);

  const fetchStoreIds = useCallback(async () => {
    const slugs = ["tokyo", "osaka", "nagoya"];
    const results = await Promise.all(slugs.map(s => fetch(`/api/store/${s}`).then(r => r.json())));
    setStores(results.map((r, i) => ({ id: r.store?.id ?? "", slug: slugs[i], name: r.store?.name ?? slugs[i] })));
  }, []);

  useEffect(() => { fetchAll(); fetchStoreIds(); }, [fetchAll, fetchStoreIds]);

  // Cast CRUD
  const saveCast = async () => {
    const url = editingCast ? `/api/cast/${editingCast}` : "/api/cast";
    const method = editingCast ? "PUT" : "POST";
    const storeId = stores.find(s => s.slug === castForm.storeId || s.id === castForm.storeId)?.id || castForm.storeId;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...castForm, storeId }) });
    if (res.ok) { flash("保存しました"); setCastForm({ name: "", bio: "", imageUrl: "/images/cast-placeholder.jpg", storeId: "", order: 0 }); setEditingCast(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteCast = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/cast/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const editCast = (cast: Cast) => {
    const storeSlug = stores.find(s => s.name === cast.store.name)?.slug ?? "";
    setCastForm({ name: cast.name, bio: cast.bio, imageUrl: cast.imageUrl, storeId: storeSlug, order: 0 });
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
      // 残高を再取得
      const u = await fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] }));
      setCustomers(u.users ?? []);
    }
    else { flash(d.error ?? "エラー", true); }
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

  const TABS: { key: Tab; label: string }[] = [
    { key: "cast", label: "🐺 キャスト" },
    { key: "points", label: "⭐ ポイント付与" },
    { key: "titles", label: "🏆 称号マスタ" },
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
                  <label className="text-xs text-white/60 block mb-1">名前</label>
                  <input className="input-field" value={castForm.name} onChange={e => setCastForm(p => ({ ...p, name: e.target.value }))} placeholder="キャスト名" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">所属店舗</label>
                  <select className="input-field" value={castForm.storeId} onChange={e => setCastForm(p => ({ ...p, storeId: e.target.value }))}>
                    <option value="">選択してください</option>
                    {stores.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60 block mb-1">プロフィール</label>
                  <textarea className="input-field min-h-[80px]" value={castForm.bio} onChange={e => setCastForm(p => ({ ...p, bio: e.target.value }))} placeholder="自己紹介文" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">画像URL</label>
                  <input className="input-field" value={castForm.imageUrl} onChange={e => setCastForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="/images/..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={castForm.order} onChange={e => setCastForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveCast} className="btn-primary text-sm">{editingCast ? "更新" : "追加"}</button>
                {editingCast && <button onClick={() => { setEditingCast(null); setCastForm({ name: "", bio: "", imageUrl: "/images/cast-placeholder.jpg", storeId: "", order: 0 }); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            <div className="space-y-2">
              {casts.map(cast => (
                <div key={cast.id} className="glass-dark p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-white">{cast.name}</div>
                    <div className="text-xs text-white/40">{cast.store.name}</div>
                  </div>
                  <button onClick={() => editCast(cast)} className="text-neon-violet text-sm hover:text-neon-purple">編集</button>
                  <button onClick={() => deleteCast(cast.id)} className="text-neon-pink text-sm hover:text-red-400">削除</button>
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
                  placeholder="メールアドレスで絞り込み..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers
                  .filter(c => c.email.includes(customerSearch))
                  .map(c => (
                    <div key={c.id} className="glass-dark p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{c.email}</div>
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
