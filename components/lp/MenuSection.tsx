"use client";
import { useState } from "react";
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
  const [selected, setSelected] = useState<(typeof MENU_IMAGES)[0] | null>(null);

  return (
    <section id="sec03" className="py-20 px-4 star-bg">
      <h2 className="section-title gradient-text text-neon-glow">
        SYSTEM・MENU
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
        {MENU_IMAGES.map((img) => (
          <button
            key={img.src}
            onClick={() => setSelected(img)}
            className="relative aspect-[3/4] overflow-hidden rounded-xl
                       border border-white/10 hover:border-neon-violet
                       transition-all duration-300 hover:scale-[1.03]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-violet"
            aria-label={`${img.alt}を拡大表示`}
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night-950/60 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

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
