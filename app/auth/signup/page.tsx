"use client";
import { useState } from "react";
import Link from "next/link";
import { logoUrl } from "@/lib/logo";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [emailSent, setEmailSent] = useState(true);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "登録に失敗しました");
      } else {
        setEmailSent(data.emailSent !== false);
        setMessage(data.message);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("接続がタイムアウトしました。しばらくしてから再度お試しください。");
      } else {
        setError("通信エラーが発生しました。しばらくしてから再度お試しください。");
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/">
            <img src={logoUrl} alt="星狼 ロゴ" width={120} height={60} className="object-contain mx-auto mb-4 w-[120px] h-[60px]" />
          </Link>
          <h1 className="text-2xl font-black gradient-text">会員登録</h1>
          <p className="text-white/50 text-sm mt-1">星狼会員になる</p>
        </div>

        {message ? (
          <div className="glass p-6 text-center space-y-3">
            <div className="text-2xl">{emailSent ? "📧" : "⚠️"}</div>
            <p className={emailSent ? "text-white/80" : "text-yellow-300/90"}>{message}</p>
            {!emailSent && (
              <p className="text-white/50 text-xs">
                登録は完了しています。後ほど再度お試しいただくか、管理者までお問い合わせください。
              </p>
            )}
            <Link href="/auth/login" className="btn-primary block text-center text-sm">
              ログインへ
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
            {error && (
              <div className="text-neon-pink text-sm text-center p-3 bg-pink-950/30 rounded-lg">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm text-white/70 mb-1">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">パスワード（8文字以上）</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="input-field"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "送信中..." : "確認メールを送信"}
            </button>
            <p className="text-center text-sm text-white/50">
              すでにアカウントをお持ちの方は{" "}
              <Link href="/auth/login" className="text-neon-violet hover:text-neon-purple">
                ログイン
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
