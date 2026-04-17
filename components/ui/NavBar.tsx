"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const ConceptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
  </svg>
);

const CastIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const MenuIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 3h18v4H3zM3 10h18M3 14h18M3 18h12" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const RankingIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="10" width="4" height="11" rx="1" />
    <rect x="10" y="5" width="4" height="16" rx="1" />
    <rect x="18" y="2" width="4" height="19" rx="1" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const NAV_ITEMS = [
  { href: "/#sec01", label: "CONCEPT",  Icon: ConceptIcon },
  { href: "/#sec02", label: "CAST",     Icon: CastIcon },
  { href: "/#sec03", label: "SYSTEM",   Icon: SystemIcon },
  { href: "/#menu",  label: "MENU",     Icon: MenuIcon },
  { href: "/#sec04", label: "CALENDAR", Icon: CalendarIcon },
  { href: "/ranking", label: "RANKING", Icon: RankingIcon },
  { href: "/#sec06", label: "ACCESS",   Icon: MapPinIcon },
  { href: "/#sec07", label: "SNS",      Icon: HeartIcon },
];

interface SessionUser { id: string; role: string }

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => {
        if (r.status === 401) return null; // 未ログインは正常。エラーとして扱わない
        if (!r.ok) return null;
        return r.json();
      })
      .then(d => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  // スクロール時にハンバーガーを閉じる（意図したスクロールのみ。開閉直後の誤検知や数 px の jitter で閉じない）
  useEffect(() => {
    if (!open) return;
    const openScrollY = window.scrollY;
    const openedAt = Date.now();
    const handleScroll = () => {
      if (Date.now() - openedAt < 280) return;
      if (Math.abs(window.scrollY - openScrollY) > 20) setOpen(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const navLinkClass =
    "nav-link-holo flex flex-col items-center gap-0.5 px-2.5 py-2 text-white/60 hover:text-white transition-colors text-[10px] font-rajdhani font-semibold tracking-widest";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 nav-holo-border"
      style={{ background: "rgba(7, 6, 14, 0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ロゴ */}
        <Link href="/" className="flex-shrink-0 group">
          <span className="holo-text font-orbitron font-bold text-base tracking-wider">
            VLiverLab
          </span>
        </Link>

        {/* PC ナビ */}
        <nav className="hidden md:flex items-center gap-0.5" aria-label="メインナビゲーション">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link key={`${href}-${label}`} href={href} className={navLinkClass}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
          {user ? (
            <div className="flex items-center gap-2 ml-4">
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn-secondary text-sm py-1.5 px-3">
                  管理画面
                </Link>
              )}
              <Link href="/me" className="btn-secondary text-sm py-1.5 px-3">
                マイページ
              </Link>
              <button onClick={handleLogout} className="btn-primary text-sm py-1.5 px-3">
                ログアウト
              </button>
            </div>
          ) : (
            <Link href="/auth/login" className="ml-4 btn-primary text-sm py-2 px-4">
              ログイン
            </Link>
          )}
        </nav>

        {/* スマホ: ログインボタン + ハンバーガー */}
        <div className="md:hidden flex items-center gap-2">
          {user ? (
            <Link href="/me" className="btn-secondary text-xs py-1.5 px-3">
              マイページ
            </Link>
          ) : (
            <Link href="/auth/login" className="btn-primary text-xs py-1.5 px-3">
              ログイン
            </Link>
          )}
          <button
            type="button"
            className="text-white/80 hover:text-white p-2 transition-colors"
            style={{ touchAction: "manipulation" }}
            onClick={() => setOpen(!open)}
            aria-label="メニューを開く"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* スマホメニュー */}
      {open && (
        <div
          className="md:hidden border-t border-white/10 py-4"
          style={{ background: "rgba(7, 6, 14, 0.95)", backdropFilter: "blur(20px)" }}
        >
          <div className="grid grid-cols-4 gap-1 px-4">
            {NAV_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={`${href}-${label}-sp`}
                href={href}
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-1 py-3 text-white/60 hover:text-white transition-colors text-[10px] font-rajdhani font-semibold tracking-wider"
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </div>
          <div className="px-4 mt-4 space-y-2">
            {user ? (
              <>
                {user.role === "ADMIN" && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="btn-secondary block w-full text-center text-sm">
                    管理画面
                  </Link>
                )}
                <Link href="/me" onClick={() => setOpen(false)} className="btn-secondary block w-full text-center text-sm">
                  マイページ
                </Link>
                <button onClick={handleLogout} className="btn-primary block w-full text-center text-sm">
                  ログアウト
                </button>
              </>
            ) : (
              <Link href="/auth/login" onClick={() => setOpen(false)} className="btn-primary block w-full text-center text-sm">
                ログイン / 会員登録
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
