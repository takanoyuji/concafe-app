const RULES = [
  "テーブルの上以外の写真・動画撮影禁止",
  "カウンター内に入ること禁止",
  "キャストへの個人情報・連絡先を聞くこと禁止（Twitter/Instagramは可）",
  "他のお客様の個人情報を聞く行為禁止（SNSも禁止）",
  "繋がり行為はキャスト・お客様に関わらず禁止",
  "飲酒の強要・危険な飲酒行為禁止",
  "お客様からの接触・スキンシップ禁止",
  "キャストへの手作り飲食物の差し入れ禁止",
  "キャストと店外で会うこと禁止（コスプレイベントは可。プライベートは出禁対象。出待ちは通報）",
  "誹謗中傷禁止（ネット上含む。出禁対象。ひどい場合は法的措置）",
];

const XMarkIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function RulesSection() {
  return (
    <section id="sec-rules" className="py-24 px-4">
      <div className="holo-divider" />
      <div className="max-w-2xl mx-auto pt-12 space-y-8">

        <div className="text-center space-y-3">
          <h2 className="section-title" style={{ color: "rgba(255,255,255,0.88)", marginBottom: "0.5rem" }}>RULES</h2>
          <p className="text-white/65 text-sm leading-relaxed">
            すべてのお客様に気持ちよくお過ごしいただくためのルールです。<br />
            違反した場合はご退場いただく場合があります。
          </p>
        </div>

        <div
          className="glass-card p-6 md:p-8 space-y-3.5"
          data-reveal
          style={{ borderColor: "rgba(255,255,255,0.07)" }}
        >
          {RULES.map((rule, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <span
                className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,45,155,0.13)", color: "#ff2d9b" }}
              >
                <XMarkIcon />
              </span>
              <p className="text-white/85 text-sm leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
