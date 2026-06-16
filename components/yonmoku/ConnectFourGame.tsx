"use client";

import { useState, useCallback } from "react";

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────
const ROWS = 6;
const COLS = 7;

// プレイヤー定義
export type Player = "red" | "yellow";

// セルの値（null = 空）
export type Cell = Player | null;

// 盤面：ROWS行 × COLS列 の2次元配列
export type Board = Cell[][];

// 勝利ラインのセル座標
export type WinLine = [number, number][];

// ゲーム状態
interface GameState {
  board: Board;
  current: Player; // 現在の手番
  winner: Player | null;
  winLine: WinLine | null;
  isDraw: boolean;
}

// ─────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────

function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/** 指定列にコマを落とす。成功すれば [新しい盤面, 着地行] を返し、満杯なら null を返す */
function dropPiece(
  board: Board,
  col: number,
  player: Player
): [Board, number] | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      const next = board.map((r) => [...r]);
      next[row][col] = player;
      return [next, row];
    }
  }
  return null; // 列が満杯
}

/** 勝利判定。4連続があれば座標リストを返す */
function checkWin(board: Board, player: Player): WinLine | null {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (board[row][col] !== player) continue;
      for (const [dr, dc] of dirs) {
        const cells: WinLine = [[row, col]];
        for (let i = 1; i < 4; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) break;
          cells.push([r, c]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function checkDraw(board: Board): boolean {
  return board[0].every((cell) => cell !== null);
}

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────

const INITIAL_STATE: GameState = {
  board: createEmptyBoard(),
  current: "red",
  winner: null,
  winLine: null,
  isDraw: false,
};

export const PLAYER_COLOR: Record<Player, string> = {
  red: "#ff2d9b",    // holo-pink
  yellow: "#ffe14d", // holo-yellow
};

export const PLAYER_LABEL: Record<Player, string> = {
  red: "赤（P1）",
  yellow: "黄（P2）",
};

// ─────────────────────────────────────────
// メインコンポーネント
// ─────────────────────────────────────────

export default function ConnectFourGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // 最後に落とされたコマの位置（落下アニメーション用）
  // uid は同じ場所への再配置でもアニメーションが再トリガーされるようにするため
  const [lastDrop, setLastDrop] = useState<{ row: number; col: number; uid: number } | null>(null);

  const handleColClick = useCallback(
    (col: number) => {
      if (state.winner || state.isDraw) return;

      const result = dropPiece(state.board, col, state.current);
      if (!result) return; // 列が満杯

      const [nextBoard, landedRow] = result;

      // 落下アニメーション：着地行をセット
      setLastDrop({ row: landedRow, col, uid: Date.now() });

      // 勝利判定
      const winLine = checkWin(nextBoard, state.current);
      if (winLine) {
        setState({ ...state, board: nextBoard, winner: state.current, winLine });
        return;
      }

      // 引き分け判定
      if (checkDraw(nextBoard)) {
        setState({ ...state, board: nextBoard, isDraw: true });
        return;
      }

      // 手番交代
      setState({
        ...state,
        board: nextBoard,
        current: state.current === "red" ? "yellow" : "red",
      });
    },
    [state]
  );

  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    setLastDrop(null);
    setHoverCol(null);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* ゲームステータス */}
      <GameStatus state={state} />

      {/* 盤面 */}
      <BoardArea
        state={state}
        hoverCol={hoverCol}
        lastDrop={lastDrop}
        onColClick={handleColClick}
        onHoverCol={setHoverCol}
      />

      {/* リセットボタン */}
      <button
        onClick={handleReset}
        className="btn-secondary w-full max-w-xs text-sm font-rajdhani font-semibold py-3 rounded-xl"
        aria-label="ゲームをリセットして最初からやり直す"
      >
        リセット
      </button>

      {/* プレイヤー凡例 */}
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

// ─────────────────────────────────────────
// 盤面コンポーネント（GameとOnlineGameで共有）
// ─────────────────────────────────────────

interface BoardAreaProps {
  state: Pick<GameState, "board" | "current" | "winner" | "winLine" | "isDraw">;
  hoverCol: number | null;
  lastDrop: { row: number; col: number; uid: number } | null;
  onColClick: (col: number) => void;
  onHoverCol: (col: number | null) => void;
  /** この盤面で手を打てるか（オンライン対戦で相手の番のとき false にする） */
  canPlay?: boolean;
}

export function BoardArea({
  state,
  hoverCol,
  lastDrop,
  onColClick,
  onHoverCol,
  canPlay = true,
}: BoardAreaProps) {
  const winSet = new Set(state.winLine?.map(([r, c]) => `${r}-${c}`) ?? []);
  const isOver = !!state.winner || state.isDraw;

  return (
    <div className="w-full max-w-sm sm:max-w-md">
      {/* 列選択インジケーター（▼ 矢印） */}
      <div
        className="grid gap-1 mb-1"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        role="group"
        aria-label="列を選択してコマを置く"
      >
        {Array.from({ length: COLS }, (_, col) => {
          const isFull = state.board[0][col] !== null;
          const disabled = isOver || isFull || !canPlay;
          return (
            <button
              key={col}
              onClick={() => onColClick(col)}
              onMouseEnter={() => onHoverCol(col)}
              onMouseLeave={() => onHoverCol(null)}
              disabled={disabled}
              aria-label={`${col + 1}列目にコマを置く`}
              className="flex items-center justify-center h-7 rounded text-sm transition-colors duration-150"
              style={{
                color: !disabled && hoverCol === col ? PLAYER_COLOR[state.current] : "transparent",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: isFull ? 0.25 : 1,
              }}
            >
              ▼
            </button>
          );
        })}
      </div>

      {/* 盤面本体 */}
      <div
        className="glass-dark rounded-2xl p-2 sm:p-3 w-full"
        style={{ boxShadow: "0 0 32px rgba(0,240,255,0.06)" }}
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {state.board.map((row, rowIdx) =>
            row.map((cell, colIdx) => {
              const isWin = winSet.has(`${rowIdx}-${colIdx}`);
              const isHover = !isOver && canPlay && hoverCol === colIdx;
              const isLastDrop =
                lastDrop !== null &&
                lastDrop.row === rowIdx &&
                lastDrop.col === colIdx;

              // 落下アニメーション：--piece-drop-from で落下距離を指定
              // 110% ≈ セル1個分（cell + gap）。rowIdx 行ぶんだけ上から落ちてくる見た目にする
              const dropFromVal = isLastDrop
                ? `-${Math.max(rowIdx, 1) * 110}%`
                : undefined;

              return (
                <button
                  key={isLastDrop ? `cell-${rowIdx}-${colIdx}-${lastDrop!.uid}` : `cell-${rowIdx}-${colIdx}`}
                  onClick={() => onColClick(colIdx)}
                  onMouseEnter={() => onHoverCol(colIdx)}
                  onMouseLeave={() => onHoverCol(null)}
                  disabled={isOver || !canPlay}
                  aria-label={
                    cell
                      ? `${rowIdx + 1}行${colIdx + 1}列: ${PLAYER_LABEL[cell]}のコマ`
                      : `${rowIdx + 1}行${colIdx + 1}列: 空`
                  }
                  className="aspect-square rounded-full"
                  style={{
                    background: cell
                      ? PLAYER_COLOR[cell]
                      : isHover
                      ? "rgba(0,240,255,0.12)"
                      : "rgba(255,255,255,0.05)",
                    boxShadow: isWin
                      ? `0 0 14px 5px ${PLAYER_COLOR[cell as Player]}, 0 0 4px 1px ${PLAYER_COLOR[cell as Player]}`
                      : cell
                      ? `0 0 5px 1px ${PLAYER_COLOR[cell]}44`
                      : isHover
                      ? "0 0 8px 2px rgba(0,240,255,0.2)"
                      : "none",
                    transform: isWin ? "scale(1.12)" : "scale(1)",
                    border: cell ? "none" : "1px solid rgba(255,255,255,0.07)",
                    cursor: isOver || !canPlay ? "default" : "pointer",
                    // 落下アニメーション
                    ...(isLastDrop
                      ? {
                          animation: "piece-drop 0.55s ease-out",
                          "--piece-drop-from": dropFromVal,
                        }
                      : {}),
                  } as React.CSSProperties}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// ゲームステータス表示
// ─────────────────────────────────────────

interface GameStatusProps {
  state: Pick<GameState, "current" | "winner" | "isDraw">;
  /** オンライン対戦時に「あなたの番 / 相手の番」を表示するためのロール */
  myRole?: Player | "spectator" | null;
  waitingForOpponent?: boolean;
}

export function GameStatus({ state, myRole, waitingForOpponent }: GameStatusProps) {
  let message: string;
  let color: string;

  if (waitingForOpponent) {
    message = "対戦相手を待っています…";
    color = "var(--text-secondary)";
  } else if (state.winner) {
    message = `${PLAYER_LABEL[state.winner]} の勝ち！🎉`;
    color = PLAYER_COLOR[state.winner];
  } else if (state.isDraw) {
    message = "引き分け！";
    color = "var(--holo-cyan)";
  } else if (myRole && myRole !== "spectator") {
    // オンライン対戦：自分の番かどうかを表示
    const isMyTurn = myRole === state.current;
    message = isMyTurn ? "あなたの番です" : "相手の番を待っています…";
    color = isMyTurn ? PLAYER_COLOR[myRole] : "var(--text-secondary)";
  } else {
    message = `${PLAYER_LABEL[state.current]} の番`;
    color = PLAYER_COLOR[state.current];
  }

  return (
    <div
      className="glass-card px-6 py-3 rounded-xl text-center text-sm font-rajdhani font-semibold"
      style={{ color, borderColor: `${color}44`, minWidth: "14rem" }}
      role="status"
      aria-live="polite"
    >
      {!state.winner && !state.isDraw && !waitingForOpponent && (
        <span
          className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
          style={{ background: color, boxShadow: `0 0 6px 2px ${color}88` }}
          aria-hidden="true"
        />
      )}
      {message}
    </div>
  );
}
