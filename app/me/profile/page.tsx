"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/ui/NavBar";

interface Store {
  id: string;
  name: string;
}

interface Cast {
  id: string;
  name: string;
  store: { name: string };
}

function ProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSetup = searchParams.get("setup") === "1";

  const [name, setName] = useState("");
  const [favoriteStoreId, setFavoriteStoreId] = useState("");
  const [favoriteCast1Id, setFavoriteCast1Id] = useState("");
  const [favoriteCast2Id, setFavoriteCast2Id] = useState("");

  const [stores, setStores] = useState<Store[]>([]);
  const [casts, setCasts] = useState<Cast[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, storesRes, castsRes] = await Promise.all([
          fetch("/api/me/profile-data"),
          fetch("/api/stores"),
          fetch("/api/cast"),
        ]);
        if (profileRes.status === 401) {
          router.replace("/auth/login");
          return;
        }
        const profileData = profileRes.ok ? await profileRes.json() : {};
        const storesData = storesRes.ok ? await storesRes.json() : [];
        const castsJson = castsRes.ok ? await castsRes.json() : { casts: [] };
        const castsData = castsJson.casts ?? [];

        setName(profileData.name ?? "");
        setFavoriteStoreId(profileData.favoriteStoreId ?? "");
        setFavoriteCast1Id(profileData.favoriteCast1Id ?? "");
        setFavoriteCast2Id(profileData.favoriteCast2Id ?? "");
        setStores(storesData);
        setCasts(castsData);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          favoriteStoreId: favoriteStoreId || null,
          favoriteCast1Id: favoriteCast1Id || null,
          favoriteCast2Id: favoriteCast2Id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "保存に失敗しました");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/me"), 1500);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  const filteredCastsFor = (excludeId: string) =>
    casts.filter((c) => c.id !== excludeId);

  if (loading) return null;

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-lg mx-auto">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center mb-2">
          プロフィール設定
        </h1>
        {isSetup && (
          <p className="text-center text-white/60 text-sm mb-6">
            メール認証が完了しました！プロフィールを設定してください。
          </p>
        )}

        {success && (
          <div className="glass border border-green-500/30 bg-green-500/10 p-4 rounded-xl mb-6 text-center text-green-400 font-bold">
            保存しました！マイページに移動します...
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass p-6 space-y-6 mt-6">
          {/* 名前 */}
          <div className="space-y-2">
            <label className="block text-white/70 text-sm font-medium">
              お名前 <span className="text-neon-purple">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ニックネームなど（20文字以内）"
              maxLength={20}
              required
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-neon-purple transition-colors"
            />
          </div>

          {/* よく行く店舗 */}
          <div className="space-y-2">
            <label className="block text-white/70 text-sm font-medium">
              よく行く店舗 <span className="text-white/30 text-xs">（任意）</span>
            </label>
            <select
              value={favoriteStoreId}
              onChange={(e) => setFavoriteStoreId(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neon-purple transition-colors"
            >
              <option value="">選択しない</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#0d0820]">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 推しキャスト 1 */}
          <div className="space-y-2">
            <label className="block text-white/70 text-sm font-medium">
              推しキャスト 1 <span className="text-white/30 text-xs">（任意）</span>
            </label>
            <select
              value={favoriteCast1Id}
              onChange={(e) => setFavoriteCast1Id(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neon-purple transition-colors"
            >
              <option value="">選択しない</option>
              {filteredCastsFor(favoriteCast2Id).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d0820]">
                  {c.name}（{c.store.name}）
                </option>
              ))}
            </select>
          </div>

          {/* 推しキャスト 2 */}
          <div className="space-y-2">
            <label className="block text-white/70 text-sm font-medium">
              推しキャスト 2 <span className="text-white/30 text-xs">（任意）</span>
            </label>
            <select
              value={favoriteCast2Id}
              onChange={(e) => setFavoriteCast2Id(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-neon-purple transition-colors"
            >
              <option value="">選択しない</option>
              {filteredCastsFor(favoriteCast1Id).map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0d0820]">
                  {c.name}（{c.store.name}）
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/me")}
            className="w-full text-center text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            スキップしてマイページへ
          </button>
        </form>
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <>
        <NavBar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <p className="text-white/40">読み込み中...</p>
        </main>
      </>
    }>
      <ProfileForm />
    </Suspense>
  );
}
