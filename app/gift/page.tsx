"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

interface Cast {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
  order: number;
}

export default function GiftSelectPage() {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/cast")
      .then((r) => r.json())
      .then((d) => setCasts(d.casts ?? []));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const ids = d?.user?.favoriteCastIds;
        if (Array.isArray(ids)) setFavoriteIds(ids.filter((x: unknown) => typeof x === "string"));
      })
      .catch(() => {});
  }, []);

  const { favoriteCasts, otherCasts } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (c: Cast): boolean =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      !!(c.bio && c.bio.toLowerCase().includes(q));

    const favSet = new Set(favoriteIds);
    const favOrdered = favoriteIds
      .map((id) => casts.find((c) => c.id === id))
      .filter((c): c is Cast => !!c && match(c));

    const others = casts
      .filter((c) => !favSet.has(c.id) && match(c))
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"));

    return { favoriteCasts: favOrdered, otherCasts: others };
  }, [casts, favoriteIds, search]);

  const renderCard = (cast: Cast) => (
    <Link
      key={cast.id}
      href={`/gift/${cast.id}`}
      className="glass text-left cursor-pointer transition-all hover:border-neon-violet overflow-hidden touch-manipulation block"
    >
      <div className="relative aspect-[3/4] bg-gradient-to-br from-neon-violet/40 to-neon-purple/30">
        {cast.imageUrl && !failedImages.has(cast.id) ? (
          <Image
            src={cast.imageUrl}
            alt={cast.name}
            fill
            sizes="(max-width: 640px) 50vw, 360px"
            className="object-cover pointer-events-none select-none"
            draggable={false}
            onError={() => setFailedImages((prev) => new Set([...prev, cast.id]))}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0d0b1a 0%, #1a1033 100%)" }}
            aria-hidden
          >
            <span className="font-orbitron font-bold text-3xl" style={{ color: "#b44dff", opacity: 0.65 }}>
              {cast.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5 text-left pointer-events-none">
          <div className="font-bold text-white text-sm leading-tight drop-shadow-md">{cast.name}</div>
          {cast.bio ? (
            <div className="text-[11px] text-white/70 mt-0.5 line-clamp-2 drop-shadow-sm">{cast.bio}</div>
          ) : null}
        </div>
      </div>
    </Link>
  );

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center">🎁 キャストへギフト</h1>

        <div className="glass p-4 flex justify-between items-center">
          <span className="text-white/60 text-sm">現在の残高</span>
          <Link href="/me" className="text-star-300 font-bold hover:text-star-400">
            マイページで確認 →
          </Link>
        </div>

        <p className="text-white/50 text-sm text-center">
          キャストをタップすると、ギフト送信用のページに移動します。
        </p>

        <div>
          <label className="text-xs text-white/60 block mb-1">キャスト名で検索</label>
          <input
            className="input-field"
            placeholder="名前の一部を入力..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {favoriteCasts.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-star-300">⭐ お気に入りキャスト</h2>
            <div className="grid grid-cols-2 gap-3">{favoriteCasts.map(renderCard)}</div>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white/80">
            {favoriteCasts.length > 0 ? "その他のキャスト" : "キャストを選ぶ"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {otherCasts.map(renderCard)}
          </div>
          {favoriteCasts.length === 0 && otherCasts.length === 0 && (
            <p className="text-white/40 text-sm text-center py-6">
              {casts.length === 0 ? "キャストが登録されていません" : "該当するキャストがありません"}
            </p>
          )}
        </div>

        <div className="text-center">
          <Link href="/me" className="btn-secondary inline-block text-sm">
            ← マイページ
          </Link>
        </div>
      </main>
    </>
  );
}
