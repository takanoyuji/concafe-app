"use client";

const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const GlassIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M8 22h8M12 11v11M5 2l2 9a5 5 0 0 0 10 0l2-9H5z" />
  </svg>
);

const PLANS = [
  {
    id: "charge",
    name: "CHARGE",
    sub: "/H",
    borderColor: "#00f0ff",
    iconColor: "#00f0ff",
    Icon: ClockIcon,
    price: "¥1,100",
    priceUnit: "/ 1時間",
    badge: "1時間1オーダー制",
    extensions: [
      { label: "延長 1h", value: "¥1,100" },
      { label: "延長 30min", value: "¥750" },
    ],
    notes: [
      "必ず1時間毎にドリンクを1オーダーお願いいたします。",
    ],
  },
  {
    id: "nomiho",
    name: "飲み放題",
    sub: "/H",
    borderColor: "#ff2d9b",
    iconColor: "#ff2d9b",
    Icon: GlassIcon,
    price: "¥3,000",
    priceUnit: "/ 1時間",
    badge: null,
    extensions: [
      { label: "延長 30min", value: "¥1,500" },
    ],
    notes: [
      "900円を超えるドリンクは差額をいただきます。",
      "ショット、オリカク不可。",
    ],
  },
];

const PICKUP_MENU = [
  { name: "VTuberイメージ オリジナルカクテル", note: "チェキ付き", price: "¥1,500" },
  { name: "チェキへの落書き", note: "チェキオプション", price: "¥500" },
];

export default function SystemSection() {
  return (
    <section id="sec03" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-3xl mx-auto pt-12 space-y-12">

        {/* タイトル */}
        <h2 className="section-title holo-text">SYSTEM</h2>

        {/* 2プランカード */}
        <div
          data-reveal
          className="grid sm:grid-cols-2 gap-6"
        >
          {PLANS.map((plan, idx) => (
            <div
              key={plan.id}
              data-reveal
              data-reveal-delay={String(idx * 120)}
              className="glass-card p-6 space-y-5 relative overflow-hidden"
              style={{ borderLeft: `4px solid ${plan.borderColor}` }}
            >
              {/* グロー */}
              <div
                className="absolute top-0 left-0 w-full h-1 opacity-60"
                style={{
                  background: `linear-gradient(90deg, ${plan.borderColor}, transparent)`,
                }}
                aria-hidden="true"
              />

              {/* ヘッダー */}
              <div className="flex items-center gap-3">
                <span style={{ color: plan.iconColor }}>
                  <plan.Icon />
                </span>
                <div>
                  <span
                    className="font-orbitron font-black text-xl tracking-wider"
                    style={{ color: plan.borderColor }}
                  >
                    {plan.name}
                  </span>
                  <span className="text-white/60 text-sm ml-1 font-rajdhani">
                    {plan.sub}
                  </span>
                </div>
              </div>

              {/* 価格 */}
              <div className="flex items-baseline gap-2">
                <span
                  className="font-orbitron font-bold holo-text"
                  style={{ fontSize: "2rem", lineHeight: 1 }}
                >
                  {plan.price}
                </span>
                <span className="text-white/70 text-sm font-rajdhani">{plan.priceUnit}</span>
              </div>

              {/* バッジ */}
              {plan.badge && (
                <span
                  className="inline-block text-xs font-rajdhani font-semibold px-3 py-1 rounded-full"
                  style={{
                    border: `1px solid ${plan.borderColor}`,
                    color: plan.borderColor,
                    background: `rgba(0,240,255,0.06)`,
                  }}
                >
                  {plan.badge}
                </span>
              )}

              {/* 延長料金 */}
              <div className="space-y-1.5">
                <p className="text-white/60 text-xs font-rajdhani tracking-widest uppercase">Extension</p>
                <div className="space-y-1">
                  {plan.extensions.map((ext) => (
                    <div key={ext.label} className="flex justify-between items-center">
                      <span className="text-white/60 text-sm">{ext.label}</span>
                      <span
                        className="font-orbitron font-bold text-sm"
                        style={{ color: plan.borderColor }}
                      >
                        {ext.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 注意事項 */}
              <ul className="space-y-1">
                {plan.notes.map((note) => (
                  <li key={note} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    ※{note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 共通注意事項 */}
        <div data-reveal data-reveal-delay="200" className="glass-card p-5 space-y-2">
          <p className="text-white/60 text-xs font-rajdhani tracking-widest uppercase mb-3">Common Notes</p>
          {[
            "自動延長のため、お声掛けしておりません。",
            "お会計時に10%のTAXがかかります。",
          ].map((note) => (
            <p key={note} className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              ※{note}
            </p>
          ))}
        </div>

        {/* ━━━ 24H 無人営業 ━━━ */}
        <div data-reveal data-reveal-delay="200" className="space-y-6">

          {/* セクションヘッダー */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: "rgba(180,77,255,0.3)" }} />
            <span
              className="font-orbitron font-bold text-sm tracking-widest px-3 py-1 rounded-full"
              style={{
                color: "#b44dff",
                border: "1px solid rgba(180,77,255,0.4)",
                background: "rgba(180,77,255,0.08)",
              }}
            >
              24H UNMANNED
            </span>
            <div className="h-px flex-1" style={{ background: "rgba(180,77,255,0.3)" }} />
          </div>

          {/* 説明カード */}
          <div
            className="glass-card p-5 space-y-4"
            style={{ borderLeft: "4px solid #b44dff" }}
          >
            <div
              className="absolute top-0 left-0 w-full h-0.5 opacity-50"
              style={{ background: "linear-gradient(90deg, #b44dff, transparent)" }}
              aria-hidden="true"
            />
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              24H無人営業は<strong className="text-white">完全事前予約制</strong>となっております。
              ご連絡いただき対応可能なキャストがいた場合に営業可能となります。
              ご予約は下記の無人営業公式LINEよりお願いいたします。
            </p>
            <a
              href="https://lin.ee/UyTm2wk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #b44dff, #00f0ff)",
                backgroundSize: "200% 200%",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.04)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 24px rgba(180,77,255,0.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              無人営業のご予約はこちら
            </a>
          </div>

          {/* 料金表 */}
          <div className="glass-card overflow-hidden">
            <div
              className="px-5 py-3"
              style={{ background: "rgba(180,77,255,0.1)", borderBottom: "1px solid rgba(180,77,255,0.2)" }}
            >
              <p className="text-xs font-rajdhani font-bold tracking-widest uppercase" style={{ color: "#b44dff" }}>
                Unmanned Pricing
              </p>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {[
                { label: "チャージ", price: "¥1,210", unit: "/ 1時間" },
                { label: "アルコールドリンク", price: "¥660", unit: "" },
                { label: "ソフトドリンク", price: "¥550", unit: "" },
                { label: "持ち込み料", price: "¥1,100", unit: "" },
                { label: "キャストドリンク", price: "¥1,210", unit: "" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-white/70">{item.label}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-orbitron font-bold" style={{ color: "#b44dff" }}>
                      {item.price}
                    </span>
                    {item.unit && (
                      <span className="text-xs text-white/40 font-rajdhani">{item.unit}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="px-5 py-3 text-center"
              style={{ background: "rgba(180,77,255,0.06)", borderTop: "1px solid rgba(180,77,255,0.15)" }}
            >
              <p className="text-sm font-bold" style={{ color: "#b44dff" }}>
                1時間 <span className="font-orbitron text-white">2,000〜3,000円</span> 程でお楽しみいただけます
              </p>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="space-y-1.5 px-1">
            {[
              "無人営業日は20歳以下のお客様はご利用不可となっております。",
              "お支払い方法はリンク決済のみとなっております。",
              "料金はすべて税込です。",
            ].map((note) => (
              <p key={note} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                ※{note}
              </p>
            ))}
          </div>
        </div>

        {/* イチオシメニュー */}
        <div data-reveal data-reveal-delay="300" className="space-y-4">
          <h3
            className="font-rajdhani font-bold text-base tracking-widest uppercase"
            style={{ color: "var(--holo-cyan)" }}
          >
            ★ イチオシメニュー
          </h3>
          <div className="space-y-3">
            {PICKUP_MENU.map((item) => (
              <div
                key={item.name}
                className="glass-card px-5 py-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-white font-semibold text-sm">{item.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {item.note}
                  </p>
                </div>
                <span
                  className="font-orbitron font-bold text-lg flex-shrink-0 holo-text"
                >
                  {item.price}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-right" style={{ color: "var(--text-muted)" }}>
            全て +tax 10%
          </p>
        </div>

      </div>
    </section>
  );
}
