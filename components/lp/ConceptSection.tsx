export default function ConceptSection() {
  return (
    <section id="sec01" className="py-20 px-4 star-bg">
      <div className="max-w-3xl mx-auto">
        <h2 className="section-title gradient-text">CONCEPT</h2>

        <div data-reveal className="glass p-8 space-y-6 text-center">
          <div className="text-4xl" aria-hidden="true">🌙</div>
          <h3 className="text-xl md:text-2xl font-bold text-star-300 text-star-glow">
            星と狼が宿る、夜の物語
          </h3>
          <p className="text-white/80 leading-relaxed text-base md:text-lg">
            「星狼」は、<span className="text-star-300 font-semibold">コスプレイヤーだけが働く</span>、男装キャストが織りなすBLコンセプトカフェ。<br />
            本物のコスプレイヤーが贈る唯一無二の世界観を、<br />
            ネオンが輝く夜の空間でお楽しみください。
          </p>
          <p className="text-white/60 leading-relaxed">
            "星"のように輝き、"狼"のように強く。<br />
            あなたの来店が、私たちの物語の一ページになります。
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { icon: "⭐", label: "池袋店", sub: "東京" },
              { icon: "🌙", label: "日本橋店", sub: "大阪" },
              { icon: "🐺", label: "名古屋栄店", sub: "名古屋" },
            ].map((item) => (
              <div key={item.label} className="glass-dark p-4 rounded-xl text-center">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-xs text-white/50">{item.sub}</div>
                <div className="text-sm font-semibold text-star-300">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
