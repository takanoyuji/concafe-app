"use client";
import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NavBar from "@/components/ui/NavBar";

interface Cast {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
}

export default function GiftToCastPage({ params }: { params: Promise<{ castId: string }> }) {
  const { castId } = use(params);
  const router = useRouter();
  const [cast, setCast] = useState<Cast | null>(null);
  const [loadingCast, setLoadingCast] = useState(true);
  const [failedImage, setFailedImage] = useState(false);
  const [amount, setAmount] = useState(100);
  const [addToFavorites, setAddToFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingCast(true);
    fetch(`/api/cast/${castId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setCast(d?.cast ?? null);
          setLoadingCast(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCast(null);
          setLoadingCast(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [castId]);

  const handleGift = async () => {
    if (!cast) return;
    setLoading(true);
    setError("");
    setMessage("");

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch("/api/points/gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ castId: cast.id, amount, idempotencyKey, addToFavorites }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "ギフトに失敗しました");
    } else {
      setMessage(`${cast.name} に ${amount.toLocaleString()} pt をギフトしました！`);
    }
  };

  if (loadingCast) {
    return (
      <>
        <NavBar />
        <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto text-center text-white/60">
          読み込み中…
        </main>
      </>
    );
  }

  if (!cast) {
    return (
      <>
        <NavBar />
        <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-4 text-center">
          <p className="text-white/70">キャストが見つかりません。</p>
          <Link href="/gift" className="btn-secondary inline-block text-sm">
            キャスト一覧へ
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/gift" className="text-white/50 hover:text-white text-sm whitespace-nowrap">
            ← 一覧
          </Link>
          <h1 className="text-xl sm:text-2xl font-black gradient-text text-neon-glow flex-1 text-center truncate">
            🎁 ギフト
          </h1>
          <span className="w-12" aria-hidden />
        </div>

        {message ? (
          <div className="glass p-6 text-center text-green-400 space-y-4">
            <div className="text-2xl">🎉</div>
            <p>{message}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button type="button" onClick={() => router.push("/gift")} className="btn-secondary text-sm">
                別のキャストへ
              </button>
              <Link href="/me" className="btn-primary text-sm text-center">
                マイページへ
              </Link>
            </div>
          </div>
        ) : (
          <div className="glass p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-[5.5rem] flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-neon-violet/40 to-neon-purple/30">
                {cast.imageUrl && !failedImage ? (
                  <Image
                    src={cast.imageUrl}
                    alt={cast.name}
                    fill
                    sizes="80px"
                    className="object-cover pointer-events-none select-none"
                    draggable={false}
                    onError={() => setFailedImage(true)}
                  />
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-xl font-orbitron font-bold"
                    style={{ color: "#b44dff", opacity: 0.7 }}
                    aria-hidden
                  >
                    {cast.name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">{cast.name}</h2>
                {cast.bio ? <p className="text-xs text-white/50 mt-1 line-clamp-2">{cast.bio}</p> : null}
              </div>
            </div>

            <p className="text-sm text-white/60">
              下のボタンからポイントを贈れます。残高は
              <Link href="/me" className="text-star-300 hover:underline mx-0.5">
                マイページ
              </Link>
              で確認できます。
            </p>

            {error && (
              <div className="text-neon-pink text-sm p-3 bg-pink-950/30 rounded-lg">{error}</div>
            )}

            <div>
              <label className="block text-sm text-white/70 mb-2">ポイント数</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {[100, 300, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`px-4 py-2 rounded-full text-sm border transition-all ${
                      amount === v
                        ? "border-neon-purple text-neon-purple"
                        : "border-white/20 text-white/60 hover:border-white/40"
                    }`}
                  >
                    {v.toLocaleString()} pt
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={1}
                className="input-field"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer text-sm text-white/80">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-violet-500 flex-shrink-0"
                checked={addToFavorites}
                onChange={(e) => setAddToFavorites(e.target.checked)}
              />
              <span>
                このキャストをお気に入りに追加する
                <span className="block text-xs text-white/45 mt-0.5">
                  ギフト一覧の上部「お気に入りキャスト」に表示されます。
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={handleGift}
              disabled={loading || amount < 1}
              className="btn-primary w-full"
            >
              {loading ? "送信中..." : `${amount.toLocaleString()} pt をギフトする 🎁`}
            </button>
          </div>
        )}

        <div className="text-center">
          <Link href="/me" className="btn-secondary inline-block text-sm">
            ← マイページ
          </Link>
        </div>
      </main>
    </>
  );
}
