"use client";
import { useState } from "react";
import { clickMap } from "@/lib/analytics";

const STORES = [
  {
    slug: "osaka",
    badge: "OSAKA",
    badgeColor: "#00f0ff",
    name: "VLiverLab 大阪梅田店",
    zip: "〒530-0057",
    address: "大阪府大阪市北区曽根崎1-4-6 新御堂筋ビルB1F",
    mapQuery: "大阪府大阪市北区曽根崎1-4-6 新御堂筋ビルB1F",
    hours: [
      { label: "平日", time: "19:00 〜 22:00" },
      { label: "土日祝", time: "17:00 〜 23:00" },
    ],
  },
  {
    slug: "tokyo",
    badge: "TOKYO",
    badgeColor: "#ff2d9b",
    name: "VLiverLab 東京池袋店",
    zip: "〒171-0014",
    address: "東京都豊島区池袋3-59-9-201",
    mapQuery: "東京都豊島区池袋3-59-9",
    hours: [
      { label: "平日", time: "19:00 〜 22:00" },
      { label: "土日祝", time: "17:00 〜 23:00" },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="住所をコピー"
      aria-label="住所をコピー"
      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-200"
      style={{
        background: copied ? "rgba(0,240,255,0.15)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${copied ? "rgba(0,240,255,0.5)" : "rgba(255,255,255,0.12)"}`,
        color: copied ? "#00f0ff" : "rgba(255,255,255,0.5)",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          コピー済
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          コピー
        </>
      )}
    </button>
  );
}

export default function AccessSection() {
  return (
    <section id="sec06" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <h2 className="section-title holo-text pt-12">ACCESS</h2>

      <div data-reveal className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {STORES.map((store) => (
          <div key={store.slug} className="glass-card p-6 space-y-5">
            {/* バッジ + 店名 */}
            <div className="space-y-2">
              <span
                className="inline-block text-xs font-rajdhani font-bold px-3 py-1 rounded-full tracking-widest"
                style={{
                  color: store.badgeColor,
                  border: `1px solid ${store.badgeColor}`,
                  background: `${store.badgeColor}12`,
                }}
              >
                {store.badge}
              </span>
              <h3 className="text-base font-bold font-rajdhani text-white">
                {store.name}
              </h3>
            </div>

            {/* 住所 */}
            <div className="space-y-1.5">
              <p className="text-xs font-rajdhani tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                Address
              </p>
              <div className="flex items-start justify-between gap-3">
                <address className="not-italic text-white/80 text-sm leading-relaxed">
                  {store.zip}<br />
                  {store.address}
                </address>
                <CopyButton text={`${store.zip} ${store.address}`} />
              </div>
            </div>

            {/* 営業時間 */}
            <div className="space-y-1.5">
              <p className="text-xs font-rajdhani tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                Hours
              </p>
              <div className="space-y-1">
                {store.hours.map((h) => (
                  <div key={h.label} className="flex items-center justify-between text-sm">
                    <span className="text-white/50">{h.label}</span>
                    <span
                      className="font-rajdhani font-semibold"
                      style={{ color: store.badgeColor }}
                    >
                      {h.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Google Maps ボタン */}
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(store.mapQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm py-2 flex items-center justify-center gap-2 w-full"
              onClick={() => clickMap(store.name)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Google Maps で開く
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
