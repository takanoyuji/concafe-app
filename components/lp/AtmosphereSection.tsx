export default function AtmosphereSection() {
  return (
    <section id="sec-atmosphere" className="py-24 px-4 star-bg">
      <div className="holo-divider" />
      <div className="max-w-3xl mx-auto pt-12 space-y-10 text-center">

        <div>
          <h2 className="section-title holo-text">ATMOSPHERE</h2>
          <p className="text-white/50 text-sm mt-3 font-rajdhani tracking-widest">
            — 店内の雰囲気 —
          </p>
        </div>

        <div
          data-reveal
          className="mx-auto relative"
          style={{ maxWidth: "340px" }}
        >
          {/* ホログラフィックグロー枠 */}
          <div
            className="absolute -inset-[2px] rounded-2xl opacity-70"
            style={{
              background: "linear-gradient(135deg, #00f0ff, #b44dff, #ff2d9b)",
              filter: "blur(6px)",
            }}
            aria-hidden="true"
          />
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "9/16" }}>
            <iframe
              src="https://www.youtube.com/embed/N0jm7iAL0nk"
              title="VLiverLab 店内雰囲気"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: "none" }}
            />
          </div>
        </div>

        {/* 営業時間 */}
        <div data-reveal className="glass-card rounded-2xl p-6 text-left max-w-xl mx-auto space-y-4">
          <h3 className="font-orbitron text-sm tracking-widest text-white/50 text-center mb-4">
            BUSINESS HOURS
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(0,240,255,0.08)", border: "1px solid rgba(0,240,255,0.2)" }}>
              <p className="text-xs font-rajdhani tracking-widest text-cyan-400 mb-1">有人営業</p>
              <p className="text-white font-semibold">19:00 – 23:00</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(180,77,255,0.08)", border: "1px solid rgba(180,77,255,0.2)" }}>
              <p className="text-xs font-rajdhani tracking-widest text-purple-400 mb-1">無人営業</p>
              <p className="text-white font-semibold">有人以外の時間</p>
              <p className="text-white/60 text-xs mt-1">24時間年中無休</p>
            </div>
          </div>

          {/* 無人営業詳細 */}
          <div className="mt-2 rounded-xl p-4 space-y-3" style={{ background: "rgba(255,45,155,0.06)", border: "1px solid rgba(255,45,155,0.15)" }}>
            <p className="text-xs font-rajdhani tracking-widest text-pink-400 text-center">UNMANNED OPERATION — 無人営業について</p>
            <p className="text-white/70 text-sm leading-relaxed">
              24H無人営業は<span className="text-white font-semibold">完全事前予約制</span>です。ご連絡いただき対応可能なキャストがいた場合に営業可能となります。
            </p>
            <a
              href="https://lin.ee/UyTm2wk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg py-2 px-4 text-sm font-semibold text-white transition-transform hover:scale-105"
              style={{ background: "#06C755" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.053 2 11.111c0 2.734 1.218 5.187 3.162 6.926-.138.495-.891 3.197-.924 3.395-.04.235.086.466.31.56.223.093.48.027.636-.163.205-.25 2.607-3.244 3.077-3.829A10.86 10.86 0 0 0 12 18.222c5.523 0 10-4.053 10-9.111S17.523 2 12 2z"/>
              </svg>
              無人営業公式LINE
            </a>

            <div className="border-t border-white/10 pt-3">
              <p className="text-xs font-rajdhani tracking-widest text-white/40 mb-2 text-center">PRICE</p>
              <ul className="space-y-1 text-sm text-white/75">
                <li className="flex justify-between"><span>1時間チャージ</span><span className="text-cyan-400 font-semibold">¥1,210</span></li>
                <li className="flex justify-between"><span>アルコールドリンク</span><span className="text-cyan-400 font-semibold">¥660</span></li>
                <li className="flex justify-between"><span>ソフトドリンク</span><span className="text-cyan-400 font-semibold">¥550</span></li>
                <li className="flex justify-between"><span>持ち込み料</span><span className="text-cyan-400 font-semibold">¥1,100</span></li>
                <li className="flex justify-between"><span>キャストドリンク</span><span className="text-cyan-400 font-semibold">¥1,210</span></li>
              </ul>
              <p className="text-center text-white/60 text-xs mt-3">
                1時間 <span className="text-white font-semibold">2,000〜3,000円</span> 程でお楽しみいただけます
              </p>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-1">
              <p className="text-white/40 text-xs">※ 無人営業日は20歳以下のお客様はご利用不可となっております。</p>
              <p className="text-white/40 text-xs">※ お支払い方法はリンク決済のみとなっております、ご了承ください。</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
