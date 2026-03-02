"use client";
import { useState, useRef } from "react";
import Image from "next/image";
import Modal from "@/components/ui/Modal";

const MENU_IMAGES = [
  { src: "/images/menu/system.jpg",           alt: "システム・料金案内" },
  { src: "/images/menu/xinglang_menu00.webp", alt: "星狼メニュー表紙" },
  { src: "/images/menu/xinglang_menu01.webp", alt: "星狼メニュー 1ページ" },
  { src: "/images/menu/xinglang_menu02.webp", alt: "星狼メニュー 2ページ" },
  { src: "/images/menu/xinglang_menu03.webp", alt: "星狼メニュー 3ページ" },
  { src: "/images/menu/xinglang_menu04.webp", alt: "星狼メニュー 4ページ" },
  { src: "/images/menu/menu1.jpg",            alt: "フードメニュー 1" },
  { src: "/images/menu/menu2.jpg",            alt: "フードメニュー 2" },
  { src: "/images/menu/menu3.jpg",            alt: "フードメニュー 3" },
  { src: "/images/menu/menu4.jpg",            alt: "フードメニュー 4" },
  { src: "/images/menu/S__95674396.jpg",      alt: "限定メニュー" },
];

export default function MenuSection() {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<(typeof MENU_IMAGES)[0] | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const prev = () => setCurrent(i => (i - 1 + MENU_IMAGES.length) % MENU_IMAGES.length);
  const next = () => setCurrent(i => (i + 1) % MENU_IMAGES.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    // 水平方向の動きが垂直より大きい場合のみスワイプとして判定
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy) {
      if (dx > 0) next(); else prev();
    }
  };

  const img = MENU_IMAGES[current];

  return (
    <section id="sec03" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text text-neon-glow">
        SYSTEM・MENU
      </h2>

      <div data-reveal className="max-w-sm mx-auto relative select-none">
        {/* 画像 */}
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 cursor-pointer"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => setSelected(img)}
          aria-label={`${img.alt}を拡大表示`}
        >
          <Image
            src={img.src}
            alt={img.alt}
            fill
            sizes="(max-width: 640px) 90vw, 384px"
            className="object-cover"
            priority={current === 0}
          />
          {/* タップヒント */}
          <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
            <span className="glass text-xs text-white/70 px-3 py-1 opacity-0 group-hover:opacity-100">
              タップで拡大
            </span>
          </div>
        </div>

        {/* 前へ / 次へ ボタン */}
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 glass w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:border-neon-violet transition-all"
          aria-label="前の画像"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 glass w-10 h-10 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:border-neon-violet transition-all"
          aria-label="次の画像"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* ページカウンター */}
        <p className="text-center text-white/40 text-xs mt-3">
          {current + 1} / {MENU_IMAGES.length}
        </p>

        {/* ドットナビ */}
        <div className="flex justify-center gap-1.5 mt-2 flex-wrap">
          {MENU_IMAGES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-5 h-2 bg-neon-purple"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`${i + 1}枚目に移動`}
            />
          ))}
        </div>
      </div>

      {/* モーダル */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <Image
            src={selected.src}
            alt={selected.alt}
            width={800}
            height={1067}
            className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
          />
        </Modal>
      )}
    </section>
  );
}
