"use client";

import { clickLine, clickSns } from "@/lib/analytics";

const LINE_URL = "https://line.me/R/ti/p/@468iwzei?ts=06010015&oat_content=url";
const LINE_SOLO = "https://line.me/R/ti/p/@854yydqq?oat_content=url&ts=11212033";

const XIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const TikTokIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.01a8.16 8.16 0 0 0 4.79 1.53V7.1a4.85 4.85 0 0 1-1.03-.41z" />
  </svg>
);

const YouTubeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22.54 6.42a2.83 2.83 0 0 0-1.99-2C18.88 4 12 4 12 4s-6.88 0-8.55.46a2.83 2.83 0 0 0-1.99 2A29.94 29.94 0 0 0 1 12a29.94 29.94 0 0 0 .46 5.58 2.83 2.83 0 0 0 1.99 2C5.12 20 12 20 12 20s6.88 0 8.55-.46a2.83 2.83 0 0 0 1.99-2A29.94 29.94 0 0 0 23 12a29.94 29.94 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
  </svg>
);

const GiftIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M20 12v10H4V12" />
    <path d="M22 7H2v5h20V7z" />
    <path d="M12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const LineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
  </svg>
);

export default function SnsSection() {
  return (
    <section id="sec07" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-2xl mx-auto pt-12 space-y-12 text-center">

        {/* タイトル */}
        <h2 className="section-title holo-text">FOLLOW US</h2>

        {/* SNS アイコン 5つ */}
        <div data-reveal className="flex gap-5 justify-center flex-wrap items-center">
          <a
            href="https://x.com/vliver_lab"
            target="_blank" rel="noopener noreferrer"
            className="sns-btn sns-x"
            aria-label="X (旧Twitter)"
            onClick={() => clickSns("x", "lp")}
          >
            <XIcon />
          </a>
          <a
            href="https://www.instagram.com/v_liver_lab/"
            target="_blank" rel="noopener noreferrer"
            className="sns-btn sns-instagram"
            aria-label="Instagram"
            onClick={() => clickSns("instagram", "lp")}
          >
            <InstagramIcon />
          </a>
          <a
            href="https://www.tiktok.com/@v.liver.lab"
            target="_blank" rel="noopener noreferrer"
            className="sns-btn sns-tiktok"
            aria-label="TikTok"
            onClick={() => clickSns("tiktok", "lp")}
          >
            <TikTokIcon />
          </a>
          <a
            href="https://www.youtube.com/@VliverLab"
            target="_blank" rel="noopener noreferrer"
            className="sns-btn sns-youtube"
            aria-label="YouTube"
            onClick={() => clickSns("youtube", "lp")}
          >
            <YouTubeIcon />
          </a>
          <a
            href="https://vliverlab.official.ec/"
            target="_blank" rel="noopener noreferrer"
            className="sns-btn sns-ec"
            aria-label="遠隔プレゼント EC"
            onClick={() => clickSns("ec", "lp")}
          >
            <GiftIcon />
            <span className="sns-ec-label">遠隔プレゼント</span>
          </a>
        </div>

        {/* LINE ボタン 2つ */}
        <div data-reveal data-reveal-delay="200" className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="line-primary-btn"
            onClick={() => clickLine("予約・お問い合わせ")}
          >
            <LineIcon />
            <span>ご予約・お問い合わせ</span>
          </a>
          <a
            href={LINE_SOLO}
            target="_blank"
            rel="noopener noreferrer"
            className="line-ghost-btn"
            onClick={() => clickLine("無人営業のご予約")}
          >
            <LineIcon />
            <span>無人営業のご予約</span>
          </a>
        </div>
      </div>

      <style>{`
        .sns-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          color: white;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          flex-shrink: 0;
        }
        .sns-btn:hover {
          transform: scale(1.12);
        }
        .sns-x:hover {
          box-shadow: 0 0 20px rgba(255,255,255,0.5), 0 0 44px rgba(255,255,255,0.18);
          border-color: rgba(255,255,255,0.4);
        }
        .sns-instagram:hover {
          box-shadow: 0 0 20px rgba(255,45,155,0.65), 0 0 44px rgba(255,110,55,0.3);
          border-color: rgba(255,100,55,0.5);
        }
        .sns-tiktok:hover {
          box-shadow: 0 0 20px rgba(0,240,255,0.6), 0 0 44px rgba(0,240,255,0.22);
          border-color: rgba(0,240,255,0.45);
        }
        .sns-youtube:hover {
          box-shadow: 0 0 20px rgba(255,0,0,0.6), 0 0 44px rgba(255,50,0,0.22);
          border-color: rgba(255,30,0,0.45);
        }
        .sns-ec {
          width: auto;
          min-width: 64px;
          height: 64px;
          padding: 0 18px;
          border-radius: 32px;
          gap: 8px;
        }
        .sns-ec-label {
          font-size: 11px;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 600;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .sns-ec:hover {
          box-shadow: 0 0 20px rgba(180,77,255,0.55), 0 0 44px rgba(0,240,255,0.2);
          border-color: rgba(180,77,255,0.5);
        }

        /* LINE ボタン */
        .line-primary-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 15px 32px;
          border-radius: 9999px;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          background: linear-gradient(135deg, #00f0ff, #b44dff, #ff2d9b);
          background-size: 200% 200%;
          animation: holo-shift 4s ease infinite;
          color: white;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          white-space: nowrap;
          border: none;
        }
        .line-primary-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 0 28px rgba(180,77,255,0.55), 0 0 56px rgba(0,240,255,0.2);
        }
        .line-ghost-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 30px;
          border-radius: 9999px;
          font-size: 0.95rem;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          background: transparent;
          color: rgba(255,255,255,0.85);
          text-decoration: none;
          border: 1px solid rgba(180,77,255,0.45);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          white-space: nowrap;
        }
        .line-ghost-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 0 20px rgba(180,77,255,0.35);
          border-color: rgba(180,77,255,0.75);
        }
      `}</style>
    </section>
  );
}
