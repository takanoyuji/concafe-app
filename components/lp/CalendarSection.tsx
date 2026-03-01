export default function CalendarSection() {
  return (
    <section id="sec04" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text">CALENDAR</h2>

      <div className="glass max-w-2xl mx-auto p-8 text-center space-y-6">
        <div className="text-4xl" aria-hidden="true">📅</div>
        <p className="text-white/70 leading-relaxed">
          各店舗の出勤スケジュールはSNSにて随時更新中です。
          <br />
          詳細は公式X（Twitter）または Instagram をご確認ください。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="https://twitter.com/xinglang_cafe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-sm"
          >
            公式X（Twitter）
          </a>
          <a
            href="https://instagram.com/xinglang_cafe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            Instagram
          </a>
        </div>
      </div>
    </section>
  );
}
