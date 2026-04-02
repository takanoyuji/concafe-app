"use client";
import { useState } from "react";

const LINE_URL = "https://line.me/R/ti/p/@468iwzei?ts=06010015&oat_content=url";

const STORES = [
  {
    id: "tokyo",
    label: "東京池袋店",
    src: "https://calendar.google.com/calendar/u/0/embed?src=vliverlab.ikebukuro%40gmail.com&ctz=Asia/Tokyo",
  },
  {
    id: "osaka",
    label: "大阪梅田店",
    src: "https://calendar.google.com/calendar/u/0/embed?src=vliverlab%40gmail.com&ctz=Asia/Tokyo",
  },
] as const;

type StoreId = (typeof STORES)[number]["id"];

export default function CalendarSection() {
  const [active, setActive] = useState<StoreId>("tokyo");

  const current = STORES.find((s) => s.id === active)!;

  return (
    <section id="sec04" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-3xl mx-auto pt-12 space-y-6">

        {/* タイトル */}
        <h2 className="section-title holo-text">CALENDAR</h2>

        {/* タブ */}
        <div className="flex gap-0 border-b border-white/10">
          {STORES.map((store) => (
            <button
              key={store.id}
              onClick={() => setActive(store.id)}
              className="relative px-6 py-3 text-sm font-rajdhani font-semibold tracking-wide whitespace-nowrap transition-colors duration-200"
              style={{ color: active === store.id ? "#ffffff" : "rgba(255,255,255,0.45)" }}
            >
              {store.label}
              {active === store.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[3px]"
                  style={{ background: "linear-gradient(90deg, #00f0ff, #b44dff, #ff2d9b)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* カレンダー iframe */}
        <div
          className="glass-card overflow-hidden"
          style={{ borderColor: "rgba(0,240,255,0.12)" }}
        >
          <iframe
            key={current.id}
            src={current.src}
            className="w-full cal-iframe"
            style={{ border: 0, display: "block" }}
            title={`${current.label} 出勤カレンダー`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        {/* 補足テキスト + ボタン */}
        <div
          data-reveal
          className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left"
        >
          <p className="text-white/70 text-sm leading-relaxed">
            出勤スケジュールは各店舗のカレンダーをご確認ください。<br />
            予約はLINEにてお願いいたします。
          </p>
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm py-2.5 px-6 flex-shrink-0"
          >
            予約する
          </a>
        </div>
      </div>

      <style>{`
        .cal-iframe {
          height: 520px;
        }
        @media (max-width: 640px) {
          .cal-iframe {
            height: 380px;
          }
        }
      `}</style>
    </section>
  );
}
