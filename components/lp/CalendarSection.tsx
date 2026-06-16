const LINE_URL = "https://line.me/R/ti/p/@468iwzei?ts=06010015&oat_content=url";

const STORE = {
  id: "tokyo",
  label: "東京池袋店",
  src: "https://calendar.google.com/calendar/u/0/embed?src=vliverlab.ikebukuro%40gmail.com&ctz=Asia/Tokyo",
};

export default function CalendarSection() {
  return (
    <section id="sec04" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-3xl mx-auto pt-12 space-y-6">

        {/* タイトル */}
        <h2 className="section-title holo-text">CALENDAR</h2>

        {/* カレンダー iframe */}
        <div
          className="glass-card overflow-hidden"
          style={{ borderColor: "rgba(0,240,255,0.12)" }}
        >
          <iframe
            src={STORE.src}
            className="w-full cal-iframe"
            style={{ border: 0, display: "block" }}
            title={`${STORE.label} 出勤カレンダー`}
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
            出勤スケジュールはカレンダーをご確認ください。<br />
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
