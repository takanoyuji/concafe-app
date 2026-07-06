"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { logoUrl } from "@/lib/logo";
import { Suspense } from "react";

const REASONS: Record<string, string> = {
  expired: "認証リンクの有効期限が切れています。",
  invalid: "認証リンクが無効です。",
};

function ResendForm() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") ?? "";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  // verify-email から reason=expired&email=xxx で飛んできた場合に自動入力
  useEffect(() => {
    const e = searchParams.get("email");
    if (e) setEmail(decodeURIComponent(e));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setIsError(data.emailSent === false);
      setMessage(data.message);
    } catch {
      setIsError(true);
      setMessage("通信エラーが発生しました。しばらくしてから再度お試しください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass p-6 space-y-4">
      {reason && REASONS[reason] && (
        <div className="text-yellow-300/90 text-sm text-center p-3 bg-yellow-950/30 rounded-lg">
          {REASONS[reason]}
        </div>
      )}

      {message ? (
        <div className="text-center space-y-3">
          <div className="text-2xl">{isError ? "⚠️" : "📧"}</div>
          <p className={isError ? "text-yellow-300/90 text-sm" : "text-white/80 text-sm"}>
            {message}
          </p>
          <Link href="/auth/login" className="btn-primary block text-center text-sm">
            ログインへ
          </Link>
        </div>
      ) : (
        <>
          <p className="text-white/60 text-sm text-center">
            登録したメールアドレスを入力すると、認証メールを再送します。
          </p>
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
          <button
            onClick={handleSubmit}
            disabled={loading || !email}
            className="btn-primary w-full"
          >
            {loading ? "送信中..." : "認証メールを再送する"}
          </button>
          <p className="text-center text-sm text-white/50">
            <Link href="/auth/login" className="text-neon-violet hover:text-neon-purple">
              ログインへ戻る
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function ResendVerificationPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/">
            <img src={logoUrl} alt="星狼 ロゴ" width={120} height={60} className="object-contain mx-auto mb-4 w-[120px] h-[60px]" />
          </Link>
          <h1 className="text-2xl font-black gradient-text">認証メール再送</h1>
          <p className="text-white/50 text-sm mt-1">確認メールを再度お送りします</p>
        </div>
        <Suspense fallback={<div className="glass p-6 text-center text-white/50">読み込み中...</div>}>
          <ResendForm />
        </Suspense>
      </div>
    </div>
  );
}
