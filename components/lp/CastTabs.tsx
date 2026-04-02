"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { clickCast } from "@/lib/analytics";

type Cast = {
  id: string;
  name: string;
  imageUrl: string;
  remoteEnabled: boolean;
  unmannedEnabled: boolean;
};

export default function CastTabs({ casts }: { casts: Cast[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? casts : casts.slice(0, 8);

  return (
    <>
      {/* キャストグリッド */}
      {casts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {displayed.map((cast) => (
            <Link
              key={cast.id}
              href={`/cast/${cast.id}`}
              className="glass group hover:border-neon-violet transition-all duration-300 hover:scale-[1.03] overflow-hidden block"
              onClick={() => clickCast(cast.name)}
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
                {(cast.remoteEnabled || cast.unmannedEnabled) && (
                  <div className="absolute bottom-[44px] right-2 flex flex-col items-end gap-1">
                    {cast.remoteEnabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-[#00f0ff] border border-[#00f0ff]/40 leading-tight whitespace-nowrap">
                        ☆遠隔対応
                      </span>
                    )}
                    {cast.unmannedEnabled && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-[#b44dff] border border-[#b44dff]/40 leading-tight whitespace-nowrap">
                        ☆無人営業対応
                      </span>
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="font-bold text-sm leading-tight cast-name-pink">
                    {cast.name}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass max-w-md mx-auto p-8 text-center text-white/50">
          <p>キャスト情報は近日公開予定です</p>
        </div>
      )}

      {casts.length > 8 && (
        <div className="text-center mt-6">
          <button
            onClick={() => setShowAll(v => !v)}
            className="btn-secondary text-sm"
          >
            {showAll ? "折りたたむ" : `もっと見る（+${casts.length - 8}人）`}
          </button>
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
