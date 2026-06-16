import Link from "next/link";

// ミニゲームセクション
// トップページに配置し、/yonmoku への導線を提供する
export default function MiniGameSection() {
  return (
    <section id="minigame" className="py-20 px-4" style={{ background: "#0d0b1a" }}>
      {/* セクション区切り */}
      <div className="holo-divider" />

      {/* セクションタイトル */}
      <h2 className="section-title holo-text pt-12 text-center">MINI GAME</h2>
      <p
        className="text-center text-sm mt-2 mb-10"
        style={{ color: "var(--text-secondary)" }}
      >
        ちょっとした空き時間に遊べるコンテンツ
      </p>

      {/* ゲームカード */}
      <div className="max-w-md mx-auto">
        <div
          className="glass-card p-6 flex flex-col gap-4"
          data-reveal
          data-reveal-delay="150"
        >
          {/* アイコン + タイトル行 */}
          <div className="flex items-center gap-3">
            {/* ゲームアイコン（絵文字）をホロ背景で装飾 */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl holo-gradient flex-shrink-0">
              🔴
            </div>
            <div>
              <h3 className="font-rajdhani font-bold text-white text-xl leading-tight">
                4目並べ
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--holo-cyan)" }}>
                CONNECT FOUR
              </p>
            </div>
          </div>

          {/* 説明文 */}
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            シンプルだけど意外と奥深い、定番の2人対戦ミニゲーム。
            <br />
            7列×6行の盤面に交互にコマを置いて、先に4つ並べたほうが勝ち！
          </p>

          {/* 仕様バッジ */}
          <div className="flex flex-wrap gap-2">
            {["2人対戦", "7×6盤面", "縦・横・斜め"].map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full font-rajdhani"
                style={{
                  background: "rgba(0,240,255,0.1)",
                  border: "1px solid rgba(0,240,255,0.3)",
                  color: "var(--holo-cyan)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* 遊ぶボタン */}
          <Link
            href="/yonmoku"
            className="btn-primary text-center text-sm font-rajdhani font-semibold py-3 rounded-xl mt-1 block"
            aria-label="4目並べを遊ぶ"
          >
            遊んでみる →
          </Link>
        </div>
      </div>
    </section>
  );
}
