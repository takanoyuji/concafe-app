"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { logoUrl } from "@/lib/logo";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get("token") ?? "__session__";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: urlToken, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "エラーが発生しました");
    } else {
      router.push("/me");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
      {error && <div className="text-neon-pink text-sm text-center p-3 bg-pink-950/30 rounded-lg">{error}</div>}
      {urlToken === "__session__" && (
        <div className="text-star-300 text-sm text-center p-3 bg-yellow-950/30 rounded-lg">
          初回ログインのため、パスワードの変更が必要です
        </div>
      )}
      <div>
        <label className="block text-sm text-white/70 mb-1">新しいパスワード（8文字以上）</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="input-field" placeholder="••••••••" />
      </div>
      <div>
        <label className="block text-sm text-white/70 mb-1">パスワード（確認）</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="input-field" placeholder="••••••••" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "変更中..." : "パスワードを変更"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/">
            <img src={logoUrl} alt="VLiverLab ロゴ" width={120} height={60} className="object-contain mx-auto mb-4 w-[120px] h-[60px]" />
          </Link>
          <h1 className="text-2xl font-black gradient-text">パスワード変更</h1>
        </div>
        <Suspense fallback={<div className="glass p-6 text-center text-white/50">読み込み中...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
