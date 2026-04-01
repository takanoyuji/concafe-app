import Link from "next/link";
import { logoUrl } from "@/lib/logo";

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, #1e1354 0%, #0d0820 40%, #06040f 100%)",
      }}
    >
      {/* 背景の星 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.7 + 0.1,
              animation: `pulse ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* ロゴ */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="neon-glow-purple rounded-2xl p-2">
          <img
            src={logoUrl}
            alt="星狼 ロゴ"
            width={280}
            height={140}
            className="object-contain w-[280px] h-[140px]"
            fetchPriority="high"
          />
        </div>

        <div className="text-center space-y-4">
          <p className="text-white/60 text-sm tracking-[0.3em] uppercase">
            Male Crossdressing BL Concafe
          </p>
          <h1 className="text-4xl md:text-6xl font-black text-neon-glow gradient-text">
            星狼
          </h1>
          <p className="text-white/70 text-base md:text-lg max-w-md mx-auto leading-relaxed">
            池袋・日本橋・名古屋栄
            <br />
            男装キャストが贈る、星夜の物語
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-sm">
          <a href="#sec03" className="btn-primary text-center">
            MENU を見る
          </a>
          <Link href="/auth/signup" className="btn-secondary text-center">
            会員登録
          </Link>
        </div>

        {/* 公式LINE */}
        <a
          href="https://line.me/R/ti/p/@xinglang"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#06C755]/40 bg-[#06C755]/10 hover:bg-[#06C755]/20 hover:border-[#06C755]/70 transition-all duration-300 w-full max-w-xs sm:max-w-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#06C755]" aria-hidden="true">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
          </svg>
          <span className="text-[#06C755] font-bold text-sm">公式LINE・ご予約はこちら</span>
        </a>

        <a
          href="#sec01"
          className="text-white/40 hover:text-white/70 transition-colors animate-bounce mt-4"
          aria-label="下にスクロール"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </section>
  );
}
