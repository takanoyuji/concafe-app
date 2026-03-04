"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { logoUrl } from "@/lib/logo";

const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.3l-6.2 4 2.4-7.4L2 9.4h7.6z" />
  </svg>
);

const WolfPawIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <ellipse cx="12" cy="15.5" rx="4" ry="3.5" />
    <circle cx="7" cy="10.5" r="2.2" />
    <circle cx="11" cy="8.5" r="2" />
    <circle cx="17" cy="10.5" r="2.2" />
    <circle cx="13" cy="8.5" r="2" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const MapPinIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const HeartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M8 21h8M12 17v4M17 4h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2h2" />
    <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
  </svg>
);

const NAV_ITEMS = [
  { href: "/#sec01", label: "CONCEPT",  Icon: StarIcon },
  { href: "/#sec02", label: "CAST",     Icon: WolfPawIcon },
  { href: "/#sec03", label: "MENU",     Icon: MoonIcon },
  { href: "/#sec04", label: "CALENDAR", Icon: CalendarIcon },
  { href: "/#sec06", label: "ACCESS",   Icon: MapPinIcon },
  { href: "/#sec07", label: "SNS",      Icon: HeartIcon },
];

interface SessionUser { id: string; role: string }

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const navLinkClass = "flex flex-col items-center gap-0.5 px-3 py-2 text-white/70 hover:text-neon-purple transition-colors text-xs";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass-dark">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ロゴ（ビルドに含まれるため確実に表示） */}
        <Link href="/" className="flex-shrink-0">
          <img
            src={logoUrl}
            alt="星狼 ロゴ"
            width={100}
            height={50}
            className="object-contain h-10 w-auto"
            fetchPriority="high"
          />
        </Link>

        {/* PC ナビ */}
        <nav className="hidden md:flex items-center gap-1" aria-label="メインナビゲーション">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={navLinkClass}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/ranking" className={navLinkClass}>
            <TrophyIcon />
            <span>RANKING</span>
          </Link>

          {/* 認証ボタン */}
          {user === undefined ? null : user ? (
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

        {/* スマホ ハンバーガー */}
        <button
          className="md:hidden text-white/80 hover:text-white p-2"
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

      {/* スマホメニュー */}
      {open && (
        <div className="md:hidden glass-dark border-t border-white/10 py-4">
          <div className="grid grid-cols-3 gap-2 px-4">
            {NAV_ITEMS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex flex-col items-center gap-1 py-3 text-white/70 hover:text-neon-purple transition-colors text-xs"
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
            <Link
              href="/ranking"
              onClick={() => setOpen(false)}
              className="flex flex-col items-center gap-1 py-3 text-white/70 hover:text-neon-purple transition-colors text-xs"
            >
              <TrophyIcon />
              <span>RANKING</span>
            </Link>
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
              <Link href="/auth/login" className="btn-primary block w-full text-center text-sm">
                ログイン / 会員登録
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
