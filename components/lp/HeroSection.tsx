import Link from "next/link";

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
          {/* 通常の img で静的パスを直接指定（本番で確実に表示） */}
          <img
            src="/images/logo.jpg"
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
            池袋・日本橋・名古屋錦
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
