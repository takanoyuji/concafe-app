import Link from "next/link";

const STORES = [
  {
    slug: "tokyo",
    name: "星狼 池袋店",
    city: "東京",
    address: "〒171-0014 東京都豊島区池袋３丁目５９−９ ＦＳビル 202",
    icon: "⭐",
  },
  {
    slug: "osaka",
    name: "星狼 日本橋店",
    city: "大阪",
    address: "〒556-0005 大阪府大阪市浪速区日本橋３丁目１−１８ 菊乃好 5F",
    icon: "🌙",
  },
  {
    slug: "nagoya",
    name: "星狼 名古屋錦店",
    city: "名古屋",
    address: "〒460-0003 愛知県名古屋市中区錦３丁目１９−２４ サンステンドビル 4F-A",
    icon: "🐺",
  },
];

export default function AccessSection() {
  return (
    <section id="sec06" className="py-20 px-4" style={{ background: "#06040f" }}>
      <h2 className="section-title gradient-text">ACCESS</h2>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {STORES.map((store) => (
          <div key={store.slug} className="glass p-6 space-y-4">
            <div className="text-center">
              <span className="text-3xl" aria-hidden="true">{store.icon}</span>
              <div className="text-xs text-white/50 mt-1">{store.city}</div>
              <h3 className="text-lg font-bold text-star-300 text-star-glow mt-1">
                {store.name}
              </h3>
            </div>
            <address className="not-italic text-white/70 text-sm leading-relaxed text-center">
              {store.address}
            </address>
            <Link
              href={`/store/${store.slug}`}
              className="btn-secondary text-center text-sm block w-full"
            >
              店舗詳細・地図 →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
