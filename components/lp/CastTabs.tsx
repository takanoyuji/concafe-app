"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import CastLink from "@/components/CastLink";

type Cast = {
  id: string;
  name: string;
  imageUrl: string;
  store: { name: string; slug: string };
};

type Store = { slug: string; name: string };

const STORE_TABS = [
  { slug: "all",    label: "全店舗" },
  { slug: "tokyo",  label: "池袋店" },
  { slug: "osaka",  label: "日本橋店" },
  { slug: "nagoya", label: "名古屋栄店" },
];

export default function CastTabs({ casts }: { casts: Cast[]; stores: Store[] }) {
  const [active, setActive] = useState("all");

  const filtered =
    active === "all" ? casts : casts.filter((c) => c.store.slug === active);

  return (
    <>
      {/* タブ */}
      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {STORE_TABS.map((t) => (
          <button
            key={t.slug}
            onClick={() => setActive(t.slug)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              active === t.slug
                ? "bg-neon-violet text-white shadow-lg"
                : "glass text-white/60 hover:text-white hover:border-neon-violet"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* キャストグリッド */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {filtered.map((cast) => (
            <CastLink
              key={cast.id}
              href={`/cast/${cast.id}`}
              castName={cast.name}
              className="glass group hover:border-neon-violet transition-all duration-300 hover:scale-[1.03] overflow-hidden block"
            >
              <div className="relative aspect-[3/4] bg-night-900">
                <Image
                  src={cast.imageUrl || "/images/cast-placeholder.jpg"}
                  alt={cast.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="font-bold text-white text-sm group-hover:text-neon-purple transition-colors leading-tight">
                    {cast.name}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">{cast.store.name}</div>
                </div>
              </div>
            </CastLink>
          ))}
        </div>
      ) : (
        <div className="glass max-w-md mx-auto p-8 text-center text-white/50">
          <p>この店舗のキャスト情報は近日公開予定です</p>
        </div>
      )}

      <div className="text-center mt-10">
        <Link href="/cast" className="btn-secondary inline-block">
          キャスト一覧を見る →
        </Link>
      </div>
    </>
  );
}
