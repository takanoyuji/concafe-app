"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "ログインに失敗しました");
      return;
    }

    if (data.user?.mustChangePassword) {
      router.push("/auth/reset-password");
    } else if (data.user?.role === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/me");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass p-6 space-y-4">
      {verified && (
        <div className="text-green-400 text-sm text-center p-3 bg-green-950/30 rounded-lg">
          メールアドレスを認証しました。ログインしてください。
        </div>
      )}
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
        <label className="block text-sm text-white/70 mb-1">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input-field"
          placeholder="••••••••"
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "ログイン中..." : "ログイン"}
      </button>
      <div className="flex justify-between text-sm text-white/50">
        <Link href="/auth/forgot-password" className="hover:text-white/70">
          パスワードを忘れた方
        </Link>
        <Link href="/auth/signup" className="hover:text-white/70">
          新規登録
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/">
            <Image
              src="/images/名称未設定星狼 1.jpg"
              alt="星狼 ロゴ"
              width={120}
              height={60}
              className="object-contain mx-auto mb-4"
            />
          </Link>
          <h1 className="text-2xl font-black gradient-text">ログイン</h1>
        </div>
        <Suspense fallback={<div className="glass p-6 text-center text-white/50">読み込み中...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
