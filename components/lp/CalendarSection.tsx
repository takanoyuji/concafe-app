export default function CalendarSection() {
  return (
    <section id="sec04" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text">CALENDAR</h2>

      <div data-reveal className="glass max-w-2xl mx-auto p-8 text-center space-y-6">
        <div className="text-4xl" aria-hidden="true">📅</div>
        <p className="text-white/70 leading-relaxed">
          各店舗の出勤スケジュールは<a href="#sec07" className="text-pink-400 hover:text-pink-300 underline underline-offset-2">SNS</a>にて随時更新中です。
          <br />
          詳細はInstagram をご確認ください。
        </p>
      </div>
    </section>
  );
}
