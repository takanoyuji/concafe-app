"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { logoUrl } from "@/lib/logo";

/** 招待リンクからパスワードを設定する（docs/cast-portal-requirements.md 3章） */
export default function CastInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<{ castName: string; email: string; role: "CAST" | "MANAGER"; roleLabel: string } | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/cast/invite?token=${encodeURIComponent(token)}`)
      .then(async r => { const d = await r.json(); if (r.ok) setInfo(d); else setInvalid(d.error ?? "無効なリンクです"); })
      .catch(() => setInvalid("通信に失敗しました"));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("パスワードが一致しません"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/cast/invite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "設定に失敗しました"); return; }
      router.push(d.role === "MANAGER" ? "/admin" : "/cast/me");
      router.refresh();
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 star-bg">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/"><img src={logoUrl} alt="星狼 ロゴ" width={120} height={60} className="object-contain mx-auto mb-4 w-[120px] h-[60px]" /></Link>
          <h1 className="text-2xl font-black gradient-text">{info?.role === "MANAGER" ? "店長アカウントの設定" : "キャストページの設定"}</h1>
        </div>
        {invalid ? (
          <div className="glass p-6 text-center space-y-3">
            <p className="text-neon-pink text-sm">{invalid}</p>
            <p className="text-white/50 text-xs">店舗の担当者に招待メールの再送を依頼してください。</p>
          </div>
        ) : !info ? (
          <div className="glass p-6 text-center text-white/50 text-sm">確認中...</div>
        ) : (
          <form onSubmit={submit} className="glass p-6 space-y-4" data-testid="cast-invite-form">
            <p className="text-sm text-white/70"><span className="font-bold text-white">{info.castName || info.email}</span> さんの{info.roleLabel}アカウントを作成します。</p>
            <p className="text-xs text-white/50">ログインID: {info.email}</p>
            {error && <div className="text-neon-pink text-sm text-center p-3 bg-pink-950/30 rounded-lg">{error}</div>}
            <div>
              <label className="block text-sm text-white/70 mb-1">パスワード（8文字以上）</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="input-field" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">パスワード（確認）</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} className="input-field" autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "設定中..." : "パスワードを設定してログイン"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
