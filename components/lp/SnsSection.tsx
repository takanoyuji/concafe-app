"use client";

import { trackLineClick, trackSnsClick } from "@/lib/analytics";

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.01a8.16 8.16 0 0 0 4.79 1.53V7.1a4.85 4.85 0 0 1-1.03-.41z" />
  </svg>
);

const LineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

const STORES = [
  {
    name: "東京店（池袋）",
    x: "https://x.com/xinglang_tokyo",
    instagram: "https://www.instagram.com/xinglang_tokyo/",
    tiktok: "https://www.tiktok.com/@xinglang_tokyo",
  },
  {
    name: "大阪店（日本橋）",
    x: "https://x.com/xinglang_osaka",
    instagram: "https://www.instagram.com/xinglang_osaka/",
    tiktok: "https://www.tiktok.com/@xinglang_osaka",
  },
  {
    name: "名古屋店（栄）",
    x: "https://x.com/xinglang_nagoya",
    instagram: "https://www.instagram.com/xinglang_nagoya/",
    tiktok: "https://www.tiktok.com/@xinglang_nagoya",
  },
];

export default function SnsSection() {
  return (
    <section id="sec07" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text">SNS</h2>

      {/* LINE 予約 */}
      <div data-reveal className="max-w-sm mx-auto mb-10">
        <a
          href="https://line.me/R/ti/p/@xinglang"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackLineClick("公式")}
          className="glass flex items-center justify-center gap-3 p-5 hover:border-neon-violet transition-all duration-300 hover:scale-105"
        >
          <span className="text-[#06C755]">
            <LineIcon />
          </span>
          <div className="text-center">
            <div className="font-bold text-white text-lg">公式LINE</div>
            <div className="text-sm text-neon-purple font-semibold">ご予約はこちら</div>
          </div>
        </a>
      </div>

      {/* 店舗別 SNS */}
      <div data-reveal data-reveal-delay="150" className="max-w-4xl mx-auto space-y-6">
        {STORES.map((store) => (
          <div key={store.name} className="glass p-5">
            <h3 className="text-star-300 font-bold mb-4 text-sm text-center">{store.name}</h3>
            <div className="flex gap-3 justify-center">
              <a
                href={store.x}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSnsClick("x", store.name)}
                className="glass-dark flex-1 max-w-[120px] flex flex-col items-center gap-2 py-4 hover:border-neon-violet transition-all duration-300 hover:scale-105"
              >
                <span className="text-white"><XIcon /></span>
                <span className="text-xs text-white/60">X</span>
              </a>
              <a
                href={store.instagram}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSnsClick("instagram", store.name)}
                className="glass-dark flex-1 max-w-[120px] flex flex-col items-center gap-2 py-4 hover:border-neon-violet transition-all duration-300 hover:scale-105"
              >
                <span className="text-neon-pink"><InstagramIcon /></span>
                <span className="text-xs text-white/60">Instagram</span>
              </a>
              <a
                href={store.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackSnsClick("tiktok", store.name)}
                className="glass-dark flex-1 max-w-[120px] flex flex-col items-center gap-2 py-4 hover:border-neon-violet transition-all duration-300 hover:scale-105"
              >
                <span className="text-white"><TikTokIcon /></span>
                <span className="text-xs text-white/60">TikTok</span>
              </a>
            </div>
          </div>
        ))}

        {/* TikTok 総合 */}
        <div className="text-center">
          <a
            href="https://www.tiktok.com/@xinglang_grp"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackSnsClick("tiktok", "星狼グループ公式")}
            className="inline-flex items-center gap-2 glass px-6 py-3 hover:border-neon-violet transition-all duration-300 hover:scale-105"
          >
            <TikTokIcon />
            <span className="text-sm text-white/80">TikTok 星狼グループ公式</span>
          </a>
        </div>
      </div>

      <p className="text-center text-white/40 text-sm mt-12">
        © 2026 星狼 All rights reserved.
      </p>
    </section>
  );
}
