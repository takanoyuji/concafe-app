"use client";

import { useState } from "react";
import Link from "next/link";
import ConnectFourGame from "./ConnectFourGame";
import OnlineLobby from "./OnlineLobby";

type Mode = "local" | "online";

/**
 * /yonmoku ページのメインコンポーネント。
 * - タイトルと NavBar 分のパディングを管理
 * - ローカル対戦 / オンライン対戦 のモード切替タブ
 * - 各モードのコンテンツをレンダリング
 */
export default function YonmokuApp() {
  const [mode, setMode] = useState<Mode>("local");

  return (
    <div
      className="min-h-screen px-4 pb-16 flex flex-col items-center gap-7"
      style={{ background: "#07060e", paddingTop: "5.5rem" /* NavBar(~56px) + 余白 */ }}
    >
      {/* ページタイトル */}
      <div className="text-center">
        <h1 className="font-orbitron font-black holo-text text-3xl sm:text-4xl leading-tight">
          4目並べ
        </h1>
        <p
          className="mt-1.5 text-xs font-rajdhani tracking-widest"
          style={{ color: "var(--holo-cyan)" }}
        >
          CONNECT FOUR
        </p>
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          交互にコマを置いて、先に4つ並べたほうが勝ち！
        </p>
      </div>

      {/* モード切替タブ */}
      <div
        className="flex gap-1 p-1 rounded-full"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        role="tablist"
        aria-label="対戦モードを選択"
      >
        {(["local", "online"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="px-5 py-2 rounded-full text-sm font-rajdhani font-semibold transition-all duration-200"
            style={
              mode === m
                ? {
                    background:
                      "linear-gradient(135deg, #00f0ff 0%, #b44dff 50%, #ff2d9b 100%)",
                    color: "#ffffff",
                  }
                : { color: "var(--text-secondary)" }
            }
          >
            {m === "local" ? "ローカル対戦" : "オンライン対戦"}
          </button>
        ))}
      </div>

      {/* コンテンツエリア */}
      {mode === "local" ? <ConnectFourGame /> : <OnlineLobby />}

      {/* トップへ戻るリンク */}
      <Link
        href="/"
        className="text-sm transition-colors"
        style={{ color: "var(--text-muted)" }}
        aria-label="トップページへ戻る"
      >
        ← トップページへ戻る
      </Link>
    </div>
  );
}
