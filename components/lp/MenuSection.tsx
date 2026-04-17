"use client";
import { useState } from "react";

type DrinkItem = string | { name: string; extra: string };
interface MenuItem { id: string; category: string; name: string; price?: string | null; note?: string | null; badge?: string | null; order: number }

/* ─── フォールバック（DB未マイグレーション時・API失敗時） ─── */
const FB_SOFT_DRINKS = [
  "ジンジャエール","ジャスミンティー","紅茶","緑茶","烏龍茶",
  "コーヒー","カフェオレ","オレンジジュース","グレープフルーツ","パインジュース","ココア",
];
const FB_NONALC = [
  "いちごミルク","ストロベリーフィズ","シャーリーテンプル","レモンジンジャー",
  "ジンジャーミモザ","シンデレラ","フロリダ","ブルーソーダ",
];
const FB_FOODS = [
  { name: "バニラアイス",                    price: "¥500",   note: undefined },
  { name: "たこ焼き",                        price: "¥800",   note: undefined },
  { name: "ポテト",                          price: "¥800",   note: undefined },
  { name: "生ハム",                          price: "¥1,000", note: undefined },
  { name: "落書きオムライス（チャーハン）",   price: "¥1,500", note: undefined },
  { name: "落書きオムライス（ボロネーゼ）",   price: "¥1,500", note: undefined },
  { name: "落書きオムライス（カルボナーラ）", price: "¥1,500", note: undefined },
  { name: "持ち込み料",                      price: "¥1,000", note: "匂いの弱いもの" },
];
const FB_CHAMPAGNES = [
  { name: "カフェパ",               price: "¥8,000",   price_num: 8000,   original: false },
  { name: "アスティ",               price: "¥9,000",   price_num: 9000,   original: false },
  { name: "MAVAM",                  price: "¥22,000",  price_num: 22000,  original: false },
  { name: "モエ（白）",             price: "¥30,000",  price_num: 30000,  original: false },
  { name: "モエ（NIR）",            price: "¥55,000",  price_num: 55000,  original: false },
  { name: "モエ（アイス）",         price: "¥70,000",  price_num: 70000,  original: false },
  { name: "ドンペリ",               price: "¥150,000", price_num: 150000, original: false },
  { name: "エンジェル",             price: "¥198,000", price_num: 198000, original: false },
  { name: "アルマンド（ゴールド）", price: "¥200,000", price_num: 200000, original: false },
  { name: "オリジナルシャンパン",   price: "¥12,000",  price_num: 12000,  original: true  },
];
const FB_CAST = [
  { name: "キャスト用ドリンク", price: "¥1,100", badge: null },
  { name: "オリジナルカクテル", price: "¥1,500", badge: "チェキつき" },
];

/* ─── カクテルベース（固定） ─── */
const COCKTAIL_BASES: { id: string; name: string; color: string; items: DrinkItem[] }[] = [
  { id: "cassis",   name: "CASSIS",      color: "#b44dff",
    items: ["ソーダ","オレンジ","グレフル","アップル","パイン","ウーロン",{ name:"ミルク", extra:"+100" }] },
  { id: "campari",  name: "CAMPARI",     color: "#ff2d9b",
    items: ["ソーダ","オレンジ","グレフル","アップル","パイン","ジンジャー"] },
  { id: "litchi",   name: "LITCHI",      color: "#ff6fd8",
    items: ["ソーダ","オレンジ","グレフル","アップル","パイン","ウーロン","ジンジャー"] },
  { id: "malibu",   name: "MALIBU",      color: "#00f0ff",
    items: ["ソーダ","オレンジ","グレフル","アップル","パイン","ジンジャー",{ name:"ミルク", extra:"+100" }] },
  { id: "peche",    name: "PECHE",       color: "#ffaa4d",
    items: ["ソーダ","オレンジ","アップル","パイン","ウーロン","ジンジャー",{ name:"ミルク", extra:"+100" }] },
  { id: "passoa",   name: "PASSOA",      color: "#ff4d7d",
    items: ["ソーダ","オレンジ","グレフル","アップル","パイン","ジンジャー"] },
  { id: "amaretto", name: "AMARETTO",    color: "#ffe14d",
    items: ["ソーダ","オレンジ","ウーロン","ジンジャー",{ name:"ミルク", extra:"+100" }] },
  { id: "jin",      name: "JIN",         color: "#4d7dff",
    items: ["ジントニック","ジンバック","ジンフィズ","オレンジブロッサム"] },
  { id: "vodka",    name: "VODKA",       color: "#aee8ff",
    items: ["スクリュードライバー","モスコミュール","ソルティドッグ","ウォッカトニック"] },
  { id: "other",    name: "OTHER",       color: "#6dff9e",
    items: ["レモンサワー","緑茶ハイ","烏龍ハイ","ウーロンハイ","ジャスミンハイ",{ name:"アサヒビール", extra:"+100" }] },
  { id: "shot",     name: "SHOT",        color: "#ff6b6b",
    items: ["テキーラ","テキーラローズ",{ name:"クライナー", extra:"+100" }] },
  { id: "shot-sp",  name: "SHOT (特殊)", color: "#ffe14d",
    items: ["テキーラ観覧車 → ASK","クライナータワー → ASK"] },
];

const TABS = ["ノンアル＆フード", "カクテル", "シャンパン", "キャスト"] as const;
type TabType = typeof TABS[number];

export default function MenuSection({ initialItems = [] }: { initialItems?: MenuItem[] }) {
  const [activeTab, setActiveTab] = useState<TabType>("ノンアル＆フード");
  const [openBases, setOpenBases] = useState<string[]>(["cassis"]);
  const [dbItems] = useState<MenuItem[]>(initialItems);

  const by = (cat: string) => dbItems.filter(i => i.category === cat).sort((a, b) => a.order - b.order);
  const hasDb = dbItems.length > 0;

  const softDrinks = hasDb ? by("soft_drink").map(i => i.name) : FB_SOFT_DRINKS;
  const nonalc     = hasDb ? by("nonalc_cocktail").map(i => i.name) : FB_NONALC;
  const foods      = hasDb
    ? by("food").map(i => ({ name: i.name, price: i.price ?? "", note: i.note ?? undefined }))
    : FB_FOODS;
  const champagnes = hasDb
    ? by("champagne").map(i => ({ name: i.name, price: i.price ?? "", price_num: parseInt((i.price ?? "0").replace(/[^0-9]/g, ""), 10), original: i.badge === "original" }))
    : FB_CHAMPAGNES;
  const castMenu   = hasDb
    ? by("cast_drink").map(i => ({ name: i.name, price: i.price ?? "", badge: i.badge }))
    : FB_CAST;

  const toggleBase = (id: string) =>
    setOpenBases(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <section id="menu" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-3xl mx-auto pt-12 space-y-8">

        <h2 className="section-title holo-text text-center">MENU</h2>

        {/*
          横スクロール付き flex はモバイル WebKit で「右側のタブだけ click が飛ぶ」ことがある（横パン候補として奪われる）。
          ゲスト＝スマホ幅・管理者＝PC で再現差が出やすい。グリッドで1画面に収め、タッチは pointerdown でも切り替え。
        */}
        <div
          role="tablist"
          aria-label="メニューカテゴリ"
          className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-white/10"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              onPointerDown={(e) => {
                if (e.pointerType === "touch") setActiveTab(tab);
              }}
              className="relative px-2 py-3 sm:px-4 text-center text-xs sm:text-sm font-rajdhani font-semibold tracking-wide transition-colors duration-200 sm:whitespace-nowrap"
              style={{ color: activeTab === tab ? "#ffffff" : "rgba(255,255,255,0.45)", touchAction: "manipulation" }}
            >
              {tab}
              {activeTab === tab && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ background: "linear-gradient(90deg, #00f0ff, #b44dff, #ff2d9b)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="menu-fade" key={activeTab}>

          {activeTab === "ノンアル＆フード" && (
            <div className="space-y-8">
              <div>
                <SectionLabel>ソフトドリンク <PriceNote>各 ¥800</PriceNote></SectionLabel>
                <div className="flex flex-wrap gap-2 mt-3">
                  {softDrinks.map((d) => <DrinkTag key={d}>{d}</DrinkTag>)}
                </div>
              </div>
              <div>
                <SectionLabel>ノンアルコールカクテル <PriceNote>各 ¥900</PriceNote></SectionLabel>
                <div className="flex flex-wrap gap-2 mt-3">
                  {nonalc.map((d) => <DrinkTag key={d}>{d}</DrinkTag>)}
                </div>
              </div>
              <div>
                <SectionLabel>フード</SectionLabel>
                <div className="grid sm:grid-cols-2 gap-2 mt-3">
                  {foods.map((f) => (
                    <div key={f.name} className="glass-card px-4 py-3 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-white text-sm">{f.name}</span>
                        {f.note && <span className="text-xs ml-1.5" style={{ color: "var(--text-muted)" }}>({f.note})</span>}
                      </div>
                      <span className="font-orbitron font-bold text-sm holo-text flex-shrink-0">{f.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "カクテル" && (
            <div className="space-y-2">
              <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>各 ¥900（特記除く）</p>
              {COCKTAIL_BASES.map((base) => (
                <div key={base.id} className="glass-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleBase(base.id)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
                    style={{ touchAction: "manipulation" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: base.color, boxShadow: `0 0 6px ${base.color}` }} aria-hidden="true" />
                      <span className="font-rajdhani font-semibold text-base tracking-wider" style={{ color: base.color }}>
                        {base.name}
                      </span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className="flex-shrink-0 transition-transform duration-300"
                      style={{ color: "rgba(255,255,255,0.4)", transform: openBases.includes(base.id) ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {openBases.includes(base.id) && (
                    <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      {base.id === "shot-sp" && (
                        <p className="w-full text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                          ※価格はキャストへお問い合わせください（ASK）
                        </p>
                      )}
                      {base.items.map((item) =>
                        typeof item === "string" ? (
                          <DrinkTag key={item}>{item}</DrinkTag>
                        ) : (
                          <span key={item.name}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-white"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                            {item.name}
                            <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{item.extra}</span>
                          </span>
                        )
                      )}
                      {base.id === "shot" && (
                        <p className="w-full text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          ※キャストへのショット +¥500
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "シャンパン" && (
            <div className="relative space-y-3">
              <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="champagne-bubble absolute rounded-full"
                    style={{ left: `${8 + i * 12}%`, bottom: 0, width: `${6 + (i % 3) * 4}px`, height: `${6 + (i % 3) * 4}px`,
                      background: "rgba(255,255,255,0.18)", animationDuration: `${5 + (i % 5) * 2.4}s`, animationDelay: `${i * 0.9}s` }} />
                ))}
              </div>
              {champagnes.map((ch) => {
                const isPremium = ch.price_num >= 150000;
                return (
                  <div key={ch.name} className="glass-card px-5 py-4 flex items-center justify-between gap-3"
                    style={isPremium ? { borderColor: "rgba(255,225,77,0.35)", boxShadow: "0 0 20px rgba(255,225,77,0.08)" } : undefined}>
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {isPremium && <span aria-hidden="true">✨</span>}
                      <span className="text-white font-semibold text-sm">{ch.name}</span>
                      {ch.original && (
                        <span className="text-xs font-rajdhani font-bold px-2 py-0.5 rounded-full holo-text flex-shrink-0"
                          style={{ border: "1px solid rgba(0,240,255,0.4)", background: "rgba(0,240,255,0.06)" }}>
                          VLL ORIGINAL
                        </span>
                      )}
                    </div>
                    <span className="font-orbitron font-bold text-base flex-shrink-0">
                      {isPremium
                        ? <span style={{ color: "#ffe14d" }}>{ch.price}</span>
                        : <span className="holo-text">{ch.price}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "キャスト" && (
            <div className="space-y-3 max-w-sm mx-auto">
              {castMenu.map((item) => (
                <div key={item.name} className="glass-card px-6 py-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold">{item.name}</span>
                    {item.badge && item.badge !== "original" && (
                      <span className="text-xs font-rajdhani font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: "rgba(255,45,155,0.15)", border: "1px solid rgba(255,45,155,0.5)", color: "#ff2d9b" }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-orbitron font-bold text-lg holo-text flex-shrink-0">{item.price}</span>
                </div>
              ))}
              <p className="text-xs text-center mt-4" style={{ color: "var(--text-muted)" }}>※全て +tax 10%</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes menu-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .menu-fade { animation: menu-fade-in 0.3s ease-out both; }
        @keyframes bubble-rise {
          0%   { transform: translateY(0) scale(1);    opacity: 0; }
          10%  { opacity: 0.15; }
          90%  { opacity: 0.1; }
          100% { transform: translateY(-400px) scale(0.4); opacity: 0; }
        }
        .champagne-bubble { animation: bubble-rise linear infinite; }
      `}</style>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="font-rajdhani font-semibold text-sm tracking-widest uppercase" style={{ color: "var(--holo-cyan)" }}>{children}</h3>;
}
function PriceNote({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-rajdhani ml-2" style={{ color: "var(--text-muted)" }}>{children}</span>;
}
function DrinkTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-3 py-1.5 rounded-full text-xs text-white"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {children}
    </span>
  );
}
