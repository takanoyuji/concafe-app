"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

const PARTICLE_COLORS = [
  "#00f0ff", "#00f0ff", "#00f0ff", "#00f0ff", "#00f0ff",
  "#ff2d9b", "#ff2d9b", "#ff2d9b", "#ff2d9b",
  "#b44dff", "#b44dff", "#b44dff",
  "#ffe14d", "#ffe14d",
];

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      const count = Math.floor(55 + Math.random() * 10); // 100〜120 → 55〜65個に削減
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -(Math.random() * 0.35 + 0.08),
        size: Math.random() * 3 + 0.5,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        opacity: Math.random() * 0.55 + 0.25,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        if (p.x < -10 || p.x > canvas.width + 10 || p.y < -10) {
          p.x = Math.random() * canvas.width;
          p.y = canvas.height + 5;
          p.vy = -(Math.random() * 0.35 + 0.08);
          p.vx = (Math.random() - 0.5) * 0.45;
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;

        // ctx.filter は廃止（GPU負荷の最大要因）
        // save/restore も廃止してAPIコール削減
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2; // 4 → 2 に削減
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      // フレーム末尾でリセット
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    resize();
    initParticles();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

interface TopCast {
  id: string;
  name: string;
  imageUrl: string;
  totalPoints: number;
}

export default function HeroSection({
  topCast,
  topCastMonth,
}: {
  topCast?: TopCast | null;
  topCastMonth?: string;
}) {
  return (
    <section
      className="relative flex flex-col items-center justify-center px-4 pt-16 overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      {/* ダーク背景 */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #0d0b1a 0%, #07060e 60%)" }}
        aria-hidden="true"
      />

      {/* パーティクル */}
      <ParticleCanvas />

      {/* 中央ぼんやり光球 */}
      <div
        className="absolute pointer-events-none hero-orb"
        style={{
          width: "60vw",
          height: "60vw",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(0,240,255,0.08), rgba(180,77,255,0.05), transparent 70%)",
          borderRadius: "50%",
        }}
        aria-hidden="true"
      />

      {/* コンテンツ */}
      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center gap-6 px-4 sm:px-8">
        {/* タイトル */}
        <h1
          className="font-orbitron font-black holo-text hero-title text-center"
          style={{
            fontSize: "clamp(3rem, 8vw, 7rem)",
            lineHeight: 1.1,
            textShadow:
              "0 0 20px rgba(0,240,255,0.5), 0 0 40px rgba(180,77,255,0.3), 0 0 80px rgba(255,45,155,0.2)",
          }}
        >
          VLiverLab
        </h1>

        {/* サブタイトル */}
        <p
          className="hero-sub text-white font-rajdhani font-semibold text-center"
          style={{
            fontSize: "clamp(0.95rem, 2.5vw, 1.25rem)",
            letterSpacing: "0.15em",
          }}
        >
          VTuberと話せちゃう&nbsp;&nbsp;近未来 Cafe &amp; Bar
        </p>

        {/* 下段: ボタン(左) ＋ キャラ(右) */}
        <div className="hero-cta flex items-end justify-center gap-10 mt-2">
          {/* CTAボタン */}
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <a
              href="#menu"
              className="hero-btn-fill font-rajdhani font-bold text-base px-8 py-3 rounded-full text-white tracking-widest transition-all duration-300 text-center"
            >
              MENU を見る
            </a>
            <a
              href="https://line.me/R/ti/p/@468iwzei?ts=06010015&oat_content=url"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn-ghost font-rajdhani font-bold text-base px-8 py-3 rounded-full text-white tracking-widest transition-all duration-300"
            >
              ご予約はこちら
            </a>
          </div>

          {/* 前月1位キャラ */}
          {topCast && (
            <div
              className="relative hero-chara shrink-0 select-none"
              style={{ width: "clamp(130px, 22vw, 300px)" }}
              aria-hidden="true"
            >
              {/* ホログラフィックグロー */}
              <div
                className="absolute inset-0 rounded-2xl"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 40%, rgba(180,77,255,0.35) 0%, rgba(0,240,255,0.15) 50%, transparent 75%)",
                  filter: "blur(20px)",
                  transform: "scale(1.3)",
                }}
              />
              {/* 画像（丸角） */}
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  aspectRatio: "3/4",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Image
                  src={topCast.imageUrl}
                  alt=""
                  fill
                  className="object-cover object-top"
                  priority
                />
                {/* 下部ほんのりフェード */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(7,6,14,0.55) 0%, transparent 40%)",
                  }}
                />
              </div>
              {/* NO.1 ラベル */}
              <div
                className="absolute bottom-3 left-3 hero-chara-label text-left px-2.5 py-1.5 rounded-lg"
                style={{
                  background: "rgba(7,6,14,0.72)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,225,77,0.25)",
                }}
              >
                <p
                  className="font-rajdhani text-[10px] tracking-[0.15em] leading-none whitespace-nowrap"
                  style={{
                    color: "#ffe14d",
                    textShadow: "0 0 6px #ffe14d, 0 0 18px rgba(255,225,77,0.6)",
                  }}
                >
                  👑 {topCastMonth}&nbsp;NO.1
                </p>
                <p
                  className="font-orbitron text-sm font-bold text-white mt-1 leading-tight"
                  style={{ textShadow: "0 0 8px rgba(255,225,77,0.3)" }}
                >
                  {topCast.name}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 下スクロール矢印 */}
      <a
        href="#sec01"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hero-arrow"
        aria-label="下にスクロール"
        style={{ color: "#00f0ff", opacity: 0.6 }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-bounce"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>

      <style>{`
        /* 光球アニメーション */
        @keyframes orb-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); }
          50% { transform: translate(-50%, -50%) scale(1.1); }
        }
        .hero-orb {
          animation: orb-pulse 8s ease-in-out infinite;
        }

        /* 登場アニメーション */
        @keyframes hero-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-scale-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .hero-title {
          animation: hero-scale-in 0.7s ease-out 0.2s both;
        }
        .hero-sub {
          animation: hero-fade-up 0.6s ease-out 0.55s both;
        }
        .hero-cta {
          animation: hero-fade-up 0.6s ease-out 0.9s both;
        }
        .hero-arrow {
          animation: hero-fade-up 0.6s ease-out 1.3s both;
        }

        /* 塗りボタン */
        .hero-btn-fill {
          background: linear-gradient(135deg, #00f0ff 0%, #b44dff 50%, #ff2d9b 100%);
          background-size: 200% 200%;
          animation: holo-shift 4s ease infinite;
          will-change: background-position;
        }
        .hero-btn-fill:hover {
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(0,240,255,0.5), 0 0 40px rgba(180,77,255,0.3);
        }

        /* 前月1位キャラ */
        .hero-chara {
          animation: hero-chara-in 1.1s ease-out 0.4s both;
        }
        @keyframes hero-chara-in {
          from { opacity: 0; transform: translateX(24px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        .hero-chara-label {
          animation: hero-fade-up 0.7s ease-out 1.1s both;
        }

        /* ゴーストボタン */
        .hero-btn-ghost {
          border: 1.5px solid rgba(0,240,255,0.5);
          background: transparent;
        }
        .hero-btn-ghost:hover {
          background: linear-gradient(135deg, rgba(0,240,255,0.15), rgba(180,77,255,0.1));
          border-color: rgba(0,240,255,0.9);
          box-shadow: 0 0 16px rgba(0,240,255,0.3);
        }
      `}</style>
    </section>
  );
}
