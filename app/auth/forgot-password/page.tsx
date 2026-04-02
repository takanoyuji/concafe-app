"use client";
import { useState } from "react";
import Link from "next/link";
import { logoUrl } from "@/lib/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "エラーが発生しました");
    } else {
      setMessage(data.message);
      setResetLink(data.resetLink ?? null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/">
            <img src={logoUrl} alt="VLiverLab ロゴ" width={120} height={60} className="object-contain mx-auto mb-4 w-[120px] h-[60px]" />
          </Link>
          <h1 className="text-2xl font-black gradient-text">パスワードリセット</h1>
        </div>

        {message ? (
          <div className="glass p-6 text-center space-y-3">
            <div className="text-2xl">📧</div>
            <p className="text-white/80">{message}</p>
            {resetLink ? (
              <>
                <p className="text-white/70 text-sm">メール送信が未設定のため、以下のリンクからパスワードをリセットしてください。</p>
                <a href={resetLink} className="btn-primary block text-center text-sm break-all" target="_blank" rel="noopener noreferrer">
                  パスワードリセットページを開く
                </a>
                <p className="text-white/50 text-xs break-all">{resetLink}</p>
              </>
            ) : (
              <p className="text-white/50 text-sm">登録メールアドレスにリセットリンクを送信しました。</p>
            )}
            <Link href="/auth/login" className="btn-secondary block text-center text-sm">ログインへ戻る</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
            {error && <div className="text-neon-pink text-sm text-center p-3 bg-pink-950/30 rounded-lg">{error}</div>}
            <p className="text-white/60 text-sm">登録済みのメールアドレスを入力してください。パスワードリセットリンクを送信します。</p>
            <div>
              <label className="block text-sm text-white/70 mb-1">メールアドレス</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input-field" placeholder="you@example.com" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "送信中..." : "リセットメールを送信"}
            </button>
            <p className="text-center text-sm text-white/50">
              <Link href="/auth/login" className="hover:text-white/70">← ログインへ戻る</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
