"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { BoardArea, GameStatus, PLAYER_COLOR, PLAYER_LABEL, type Player, type Cell, type WinLine } from "./ConnectFourGame";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface RoomSnapshot {
  code: string;
  board: Cell[][];
  current: Player;
  winner: Player | null;
  winLine: WinLine | null;
  isDraw: boolean;
  playerCount: number;
  myRole: "red" | "yellow" | "spectator" | null;
}

// ─────────────────────────────────────────
// OnlineGame コンポーネント
// ─────────────────────────────────────────

interface Props {
  roomCode: string;
}

/**
 * オンライン4目並べ。
 * - localStorage から playerId を取得（なければ生成）
 * - 1.5秒ごとに GET /api/yonmoku/rooms/[code] をポーリング
 * - 自分の番のときのみコマを置ける
 */
export default function OnlineGame({ roomCode }: Props) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [notFound, setNotFound] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [lastDrop, setLastDrop] = useState<{ row: number; col: number; uid: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // ポーリング中に古い playerId を参照しないよう ref でも保持
  const playerIdRef = useRef<string>("");

  // ─── playerId の初期化 ───
  useEffect(() => {
    let id = localStorage.getItem("yonmoku_player_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("yonmoku_player_id", id);
    }
    setPlayerId(id);
    playerIdRef.current = id;
  }, []);

  // ─── ルーム状態取得 ───
  const fetchRoom = useCallback(async () => {
    const pid = playerIdRef.current;
    if (!pid) return;
    try {
      const res = await fetch(
        `/api/yonmoku/rooms/${roomCode}?playerId=${encodeURIComponent(pid)}`
      );
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      const data: RoomSnapshot = await res.json();
      setRoom(data);
    } catch {
      // ネットワークエラー → 次のポーリングまで待つ
    }
  }, [roomCode]);

  // 初回取得 + 1.5秒ポーリング
  useEffect(() => {
    if (!playerId) return;
    fetchRoom();
    const id = setInterval(fetchRoom, 1500);
    return () => clearInterval(id);
  }, [playerId, fetchRoom]);

  // ─── コマを置く ───
  const handleColClick = useCallback(
    async (col: number) => {
      if (!room || !playerId) return;
      if (room.winner || room.isDraw) return;
      if (room.myRole !== room.current) return; // 自分の番でない

      // 着地行を先に計算（落下アニメーション用）
      let landedRow = -1;
      for (let row = 5; row >= 0; row--) {
        if (room.board[row][col] === null) { landedRow = row; break; }
      }
      if (landedRow === -1) return; // 満杯

      setLastDrop({ row: landedRow, col, uid: Date.now() });

      const res = await fetch(`/api/yonmoku/rooms/${roomCode}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, col }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error ?? "エラー");
        setTimeout(() => setMoveError(null), 3000);
        return;
      }
      // サーバーのレスポンスで状態を更新（myRole は保持）
      setRoom((prev) => prev ? { ...data, myRole: prev.myRole } : null);
    },
    [room, playerId, roomCode]
  );

  // ─── リセット ───
  const handleReset = async () => {
    if (!room || !playerId) return;
    const res = await fetch(`/api/yonmoku/rooms/${roomCode}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    if (res.ok) {
      const data = await res.json();
      setRoom((prev) => prev ? { ...data, myRole: prev.myRole } : null);
      setLastDrop(null);
    }
  };

  // ─── URLコピー ───
  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/yonmoku/room/${roomCode}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── ルームが存在しない ───
  if (notFound) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-5 px-4"
        style={{ background: "#07060e" }}
      >
        <p className="font-rajdhani text-lg" style={{ color: "var(--holo-pink)" }}>
          ルームが見つかりません
        </p>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          ルームコード <strong className="font-mono">{roomCode}</strong> は存在しないか、有効期限切れです。
        </p>
        <Link href="/yonmoku" className="btn-secondary px-6 py-2.5 rounded-xl text-sm font-rajdhani font-semibold">
          ← ロビーへ戻る
        </Link>
      </div>
    );
  }

  // ─── ローディング ───
  if (!room) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#07060e" }}
      >
        <p className="text-sm font-rajdhani animate-pulse" style={{ color: "var(--text-secondary)" }}>
          接続中…
        </p>
      </div>
    );
  }

  const isMyTurn = room.myRole === room.current && !room.winner && !room.isDraw;
  const waitingForOpponent = room.playerCount < 2;
  const isSpectator = room.myRole === "spectator" || room.myRole === null;

  return (
    <div
      className="min-h-screen px-4 pb-16 flex flex-col items-center gap-7"
      style={{ background: "#07060e", paddingTop: "5.5rem" }}
    >
      {/* タイトル */}
      <div className="text-center">
        <h1 className="font-orbitron font-black holo-text text-3xl sm:text-4xl leading-tight">
          4目並べ
        </h1>
        <p className="mt-1.5 text-xs font-rajdhani tracking-widest" style={{ color: "var(--holo-cyan)" }}>
          CONNECT FOUR — ONLINE
        </p>
      </div>

      {/* ルーム情報バナー */}
      <div
        className="glass-card w-full max-w-sm px-5 py-4 flex flex-col gap-3"
      >
        {/* ルームコードと招待URLコピー */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>ルームコード</p>
            <p className="font-orbitron font-black text-xl tracking-widest holo-text">
              {roomCode}
            </p>
          </div>
          <button
            onClick={handleCopyUrl}
            className="btn-secondary text-xs font-rajdhani font-semibold px-3 py-2 rounded-lg flex-shrink-0"
            aria-label="招待URLをクリップボードにコピー"
          >
            {copied ? "✓ コピー済み" : "URLをコピー"}
          </button>
        </div>

        {/* プレイヤー参加状況 */}
        <div className="flex gap-3 text-xs">
          {(["red", "yellow"] as Player[]).map((role) => {
            const isMe = room.myRole === role;
            const hasPlayer = role === "red" ? true : room.playerCount >= 2;
            return (
              <div
                key={role}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: isMe ? `${PLAYER_COLOR[role]}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isMe ? PLAYER_COLOR[role] + "66" : "rgba(255,255,255,0.06)"}`,
                  color: hasPlayer ? PLAYER_COLOR[role] : "var(--text-muted)",
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
                  style={{
                    background: hasPlayer ? PLAYER_COLOR[role] : "transparent",
                    border: hasPlayer ? "none" : `1px solid ${PLAYER_COLOR[role]}66`,
                  }}
                />
                {PLAYER_LABEL[role]}{isMe ? "（あなた）" : ""}
                {!hasPlayer && <span style={{ color: "var(--text-muted)" }}>（未参加）</span>}
              </div>
            );
          })}
        </div>

        {/* 観戦中メッセージ */}
        {isSpectator && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            観戦モードで参加中です
          </p>
        )}
      </div>

      {/* ゲームステータス */}
      <GameStatus
        state={room}
        myRole={room.myRole}
        waitingForOpponent={waitingForOpponent}
      />

      {/* 盤面 */}
      <BoardArea
        state={room}
        hoverCol={hoverCol}
        lastDrop={lastDrop}
        onColClick={handleColClick}
        onHoverCol={setHoverCol}
        canPlay={isMyTurn && !waitingForOpponent && !isSpectator}
      />

      {/* 手順エラー */}
      {moveError && (
        <p
          className="text-xs text-center"
          style={{ color: "#ff2d9b" }}
          role="alert"
        >
          {moveError}
        </p>
      )}

      {/* コントロール */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {!isSpectator && (
          <button
            onClick={handleReset}
            className="btn-secondary w-full text-sm font-rajdhani font-semibold py-3 rounded-xl"
            aria-label="ゲームをリセット"
          >
            リセット
          </button>
        )}
        <Link
          href="/yonmoku"
          className="text-sm transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          ← ロビーへ戻る
        </Link>
      </div>

      {/* 凡例 */}
      <div className="flex gap-6 text-xs" style={{ color: "var(--text-secondary)" }}>
        {(["red", "yellow"] as Player[]).map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full inline-block flex-shrink-0"
              style={{ background: PLAYER_COLOR[p], boxShadow: `0 0 6px 2px ${PLAYER_COLOR[p]}66` }}
            />
            {PLAYER_LABEL[p]}
          </span>
        ))}
      </div>
    </div>
  );
}
