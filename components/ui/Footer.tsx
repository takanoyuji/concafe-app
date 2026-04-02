import Link from "next/link";

const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.01a8.16 8.16 0 0 0 4.79 1.53V7.1a4.85 4.85 0 0 1-1.03-.41z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.54 6.42a2.83 2.83 0 0 0-1.99-2C18.88 4 12 4 12 4s-6.88 0-8.55.46a2.83 2.83 0 0 0-1.99 2A29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.83 2.83 0 0 0 1.99 2C5.12 20 12 20 12 20s6.88 0 8.55-.46a2.83 2.83 0 0 0 1.99-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
  </svg>
);

const SNS_LINKS = [
  { href: "https://x.com/vliver_lab", Icon: XIcon, label: "X" },
  { href: "https://www.instagram.com/v_liver_lab/", Icon: InstagramIcon, label: "Instagram" },
  { href: "https://www.tiktok.com/@v.liver.lab", Icon: TikTokIcon, label: "TikTok" },
  { href: "https://www.youtube.com/@VliverLab", Icon: YouTubeIcon, label: "YouTube" },
];

export default function Footer() {
  return (
    <footer style={{ background: "#050410" }}>
      {/* ホログラフィック 1px ライン */}
      <div
        style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, #00f0ff, #b44dff, #ff2d9b, transparent)",
          boxShadow: "0 0 8px rgba(0,240,255,0.3)",
        }}
      />

      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col items-center gap-6">
        {/* 店名テキスト */}
        <Link href="/" className="group">
          <span className="font-orbitron font-bold text-sm tracking-wider holo-text">
            VLiverLab
          </span>
        </Link>

        {/* SNS アイコン */}
        <div className="flex gap-3">
          {SNS_LINKS.map(({ href, Icon, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white/90 transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <Icon />
            </a>
          ))}
        </div>

        {/* コピーライト */}
        <p className="text-white/45 text-xs font-rajdhani tracking-widest">
          © 2026 VLiverLab All rights reserved.
        </p>
      </div>
    </footer>
  );
}
