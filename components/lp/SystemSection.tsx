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
