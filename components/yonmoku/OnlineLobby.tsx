"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * オンライン対戦ロビー。
 * - ルームを作成して相手を招待
 * - ルームコードを入力して参加
 */
export default function OnlineLobby() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // playerId は localStorage で永続化（同じブラウザから同じプレイヤーとして識別する）
  useEffect(() => {
    let id = localStorage.getItem("yonmoku_player_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("yonmoku_player_id", id);
    }
    setPlayerId(id);
  }, []);

  /** ルームを新規作成してそのまま入室 */
  const handleCreate = async () => {
    if (!playerId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/yonmoku/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "作成失敗");
      router.push(`/yonmoku/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCreating(false);
    }
  };

  /** 入力されたコードのルームへ参加 */
  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setError("ルームコードを入力してください"); return; }
    if (code.length !== 6) { setError("ルームコードは6文字です"); return; }
    router.push(`/yonmoku/room/${code}`);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-xs">
      {/* ルームを作成する */}
      <div className="glass-card p-5 flex flex-col gap-3">
        <h2
          className="font-rajdhani font-bold text-base"
          style={{ color: "var(--holo-cyan)" }}
        >
          ルームを作成する
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          ルームを作成してコードを相手に共有しましょう。
          あなたは <span style={{ color: "#ff2d9b" }}>赤（P1）</span> です。
        </p>
        <button
          onClick={handleCreate}
          disabled={creating || !playerId}
          className="btn-primary text-sm font-rajdhani font-semibold py-3 rounded-xl"
          aria-label="新しいルームを作成する"
        >
          {creating ? "作成中…" : "ルームを作成 →"}
        </button>
      </div>

      {/* 区切り */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>または</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* ルームに参加する */}
      <div className="glass-card p-5 flex flex-col gap-3">
        <h2
          className="font-rajdhani font-bold text-base"
          style={{ color: "var(--holo-yellow)" }}
        >
          ルームに参加する
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          相手から受け取ったルームコード（6文字）を入力してください。
          あなたは <span style={{ color: "#ffe14d" }}>黄（P2）</span> です。
        </p>
        <input
          type="text"
          value={joinCode}
          onChange={(e) => {
            setJoinCode(e.target.value.toUpperCase());
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="例: AB3C7E"
          maxLength={6}
          className="input-field text-center text-lg font-orbitron tracking-widest py-2.5"
          aria-label="ルームコードを入力"
          style={{ letterSpacing: "0.2em" }}
        />
        <button
          onClick={handleJoin}
          className="btn-secondary text-sm font-rajdhani font-semibold py-3 rounded-xl"
          aria-label="ルームに参加する"
        >
          参加する →
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <p
          className="text-xs text-center py-2 rounded-lg"
          style={{ color: "#ff2d9b", background: "rgba(255,45,155,0.08)" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
