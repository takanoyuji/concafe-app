/**
 * yonmoku-store.ts
 *
 * 4目並べ オンライン対戦用 in-memory ルームストア。
 * - ルームはサーバー起動中のみ保持される（再起動でリセット）。ミニゲームとして許容範囲。
 * - globalThis を使って Next.js のホットリロード時に Map が再作成されるのを防ぐ。
 */

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type Player = "red" | "yellow";
export type Cell = Player | null;
export type Board = Cell[][];
export type WinLine = [number, number][];

export interface RoomState {
  code: string;
  board: Board;
  current: Player;         // 現在の手番
  winner: Player | null;
  winLine: WinLine | null;
  isDraw: boolean;
  redId: string | null;    // ルーム作成者（赤）の playerId
  yellowId: string | null; // 参加者（黄）の playerId
  createdAt: number;
  lastActivity: number;
}

// ─────────────────────────────────────────
// In-memory store
// ─────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __yonmokuRooms: Map<string, RoomState> | undefined;
}

function getRooms(): Map<string, RoomState> {
  if (!globalThis.__yonmokuRooms) {
    globalThis.__yonmokuRooms = new Map();
  }
  return globalThis.__yonmokuRooms;
}

// ─────────────────────────────────────────
// Room code generation
// ─────────────────────────────────────────

// 0/O/1/I/L などの紛らわしい文字を除外
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─────────────────────────────────────────
// Cleanup: 2時間以上アクティビティのないルームを削除
// ─────────────────────────────────────────

function cleanup(): void {
  const rooms = getRooms();
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActivity < cutoff) rooms.delete(code);
  }
}

// ─────────────────────────────────────────
// Game logic
// ─────────────────────────────────────────

const ROWS = 6;
const COLS = 7;

export function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/**
 * 勝利判定。4つ連続していれば座標リストを返し、なければ null を返す。
 * 方向: 横(0,1)・縦(1,0)・右下がり(1,1)・右上がり(1,-1)
 */
export function checkWin(board: Board, player: Player): WinLine | null {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        const cells: WinLine = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/** ルームを作成して返す */
export function createRoom(creatorId: string): RoomState {
  cleanup();
  const rooms = getRooms();
  let code: string;
  do { code = generateCode(); } while (rooms.has(code));

  const room: RoomState = {
    code,
    board: createEmptyBoard(),
    current: "red",
    winner: null,
    winLine: null,
    isDraw: false,
    redId: creatorId,
    yellowId: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

/** ルームを取得する（大文字に正規化） */
export function getRoom(code: string): RoomState | null {
  return getRooms().get(code.toUpperCase()) ?? null;
}

/**
 * ルームに参加する。
 * - すでに参加済みの場合は既存のロールを返す
 * - player2 スロットが空なら自動的に yellow として参加
 * - 満員の場合は "spectator" を返す
 */
export function joinRoom(
  code: string,
  playerId: string
): "red" | "yellow" | "spectator" | null {
  const room = getRoom(code);
  if (!room) return null;

  if (room.redId === playerId) return "red";
  if (room.yellowId === playerId) return "yellow";

  if (!room.yellowId) {
    room.yellowId = playerId;
    room.lastActivity = Date.now();
    return "yellow";
  }
  return "spectator";
}

/** 指定した列にコマを置く */
export function makeMove(
  code: string,
  playerId: string,
  col: number
): { room: RoomState } | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: "ルームが見つかりません" };
  if (room.winner || room.isDraw) return { error: "ゲームはすでに終了しています" };

  const role: Player | null =
    room.redId === playerId ? "red" :
    room.yellowId === playerId ? "yellow" : null;

  if (!role) return { error: "このルームのプレイヤーではありません" };
  if (role !== room.current) return { error: "あなたの手番ではありません" };

  // 最下部の空きマスを探す
  let placed = false;
  for (let row = ROWS - 1; row >= 0; row--) {
    if (room.board[row][col] === null) {
      room.board[row][col] = role;
      placed = true;
      break;
    }
  }
  if (!placed) return { error: "その列は満杯です" };

  // 勝利 / 引き分け判定
  const winLine = checkWin(room.board, role);
  if (winLine) {
    room.winner = role;
    room.winLine = winLine;
  } else if (room.board[0].every((c) => c !== null)) {
    room.isDraw = true;
  } else {
    room.current = role === "red" ? "yellow" : "red";
  }

  room.lastActivity = Date.now();
  return { room };
}

/** ゲームをリセットする（どちらのプレイヤーでも可） */
export function resetRoom(
  code: string,
  playerId: string
): { room: RoomState } | { error: string } {
  const room = getRoom(code);
  if (!room) return { error: "ルームが見つかりません" };
  if (room.redId !== playerId && room.yellowId !== playerId) {
    return { error: "このルームのプレイヤーではありません" };
  }

  room.board = createEmptyBoard();
  room.current = "red";
  room.winner = null;
  room.winLine = null;
  room.isDraw = false;
  room.lastActivity = Date.now();

  return { room };
}
