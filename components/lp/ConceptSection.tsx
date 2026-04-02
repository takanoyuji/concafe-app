const CARDS = [
  {
    icon: "🍸",
    title: "オリジナルカクテル",
    body: "推しVTuberのイメージオリジナルカクテルを注文！\nオリカク1杯につきチェキ1枚撮影可能。",
  },
  {
    icon: "📸",
    title: "チェキ",
    body: "VTuberのみ or ツーショットが選べる。\n落書きを頼むとその場でメッセージが！",
  },
  {
    icon: "🥂",
    title: "推しにドリンクをプレゼント",
    body: "一緒に乾杯できる！",
  },
  {
    icon: "🍾",
    title: "シャンパンでコースター",
    body: "シャンパンを注文すると世界に1つのコースターが完成。\n推しとの思い出をそのまま残せる。",
  },
];

export default function ConceptSection() {
  return (
    <section id="sec01" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-4xl mx-auto pt-12">

        {/* タイトル + 装飾ライン */}
        <div data-reveal className="flex items-center gap-4 justify-center mb-4">
          <span
            className="flex-1 max-w-[80px] sm:max-w-[120px] h-px"
            style={{ background: "linear-gradient(90deg, transparent, #00f0ff)" }}
            aria-hidden="true"
          />
          <h2
            className="section-title holo-text mb-0"
            style={{ whiteSpace: "nowrap" }}
          >
            VLiverLabとは
          </h2>
          <span
            className="flex-1 max-w-[80px] sm:max-w-[120px] h-px"
            style={{ background: "linear-gradient(90deg, #ff2d9b, transparent)" }}
            aria-hidden="true"
          />
        </div>

        {/* 本文 */}
        <p
          data-reveal
          data-reveal-delay="100"
          className="text-center text-white/70 leading-relaxed text-base md:text-lg max-w-xl mx-auto mb-14"
        >
          VTuberとお話をしながらお酒や飲み物を楽しむことのできるカフェ＆バー。<br />
          ここでしか見られない姿や、会話を楽しめることが魅力です。
        </p>

        {/* カードグリッド */}
        <div className="grid sm:grid-cols-2 gap-5">
          {CARDS.map((card, i) => (
            <div
              key={card.title}
              data-reveal
              data-reveal-delay={String(150 + i * 150)}
              className="concept-card glass-card p-6 flex flex-col gap-3"
            >
              {/* アイコン */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 holo-gradient"
                aria-hidden="true"
              >
                {card.icon}
              </div>

              {/* タイトル */}
              <h3 className="font-rajdhani font-semibold text-white text-lg leading-tight">
                {card.title}
              </h3>

              {/* 本文 */}
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {card.body.split("\n").map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < card.body.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .concept-card {
          transition: border-color 0.3s ease-out, box-shadow 0.3s ease-out, transform 0.3s ease-out;
        }
        .concept-card:hover {
          border-color: rgba(0, 240, 255, 0.5) !important;
          box-shadow:
            0 0 20px rgba(0, 240, 255, 0.15),
            0 0 40px rgba(180, 77, 255, 0.08);
          transform: translateY(-8px);
        }
      `}</style>
    </section>
  );
}
