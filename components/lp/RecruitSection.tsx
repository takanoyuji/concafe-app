const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function RecruitSection() {
  return (
    <section id="sec-recruit" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-2xl mx-auto pt-12 space-y-8 text-center">

        <h2 className="section-title holo-text">RECRUIT</h2>

        <div className="glass-card p-8 md:p-12 space-y-6" data-reveal>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-white font-rajdhani tracking-wide">
              お試しキャスト 随時募集中！
            </p>
            <p
              className="font-rajdhani font-semibold tracking-widest text-sm"
              style={{ color: "#00f0ff" }}
            >
              VLIVERLAB CAST RECRUIT
            </p>
          </div>

          <div className="space-y-3 text-white/70 text-sm leading-relaxed">
            <p>VLiverLabではお試しキャスト様を随時募集中です。</p>
            <p>
              <span className="font-semibold" style={{ color: "#00f0ff" }}>VLiver（VTuber）さん</span>であれば男女問わず出勤可能。<br />
              正式キャストになれる可能性もあります。
            </p>
            <p>詳しくは公式X（旧Twitter）のDMにてご連絡ください。</p>
          </div>

          <a
            href="https://x.com/vliver_lab"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-3 px-8 py-4 text-base"
          >
            <XIcon />
            応募する（X DMへ）
          </a>
        </div>
      </div>
    </section>
  );
}
