/**
 * CastMaster.castCode の採番。
 *
 * castCode は外部システム（remodri 等）がキャストを参照するための不変コード。
 * 一度振ったら二度と変えない。改名しても退職しても同じコードを使い続ける。
 */

const PREFIX = "C";
const DIGITS = 4;

/** 12 -> "C0012"。1万を超えたら桁が伸びるだけで壊れない */
export function formatCastCode(n: number): string {
  return PREFIX + String(n).padStart(DIGITS, "0");
}

/** "C0012" -> 12。形式に合わないものは 0 を返す */
export function parseCastCode(code: string): number {
  const m = /^C(\d+)$/.exec(code);
  return m ? Number(m[1]) : 0;
}

/**
 * 既存コードの一覧から、次の番号を順に返す採番関数を作る。
 * 空き番号は再利用しない（削除されたコードを別人に振らないため）。
 */
export function createCastCodeAllocator(existingCodes: string[]): () => string {
  let max = existingCodes.reduce((acc, c) => Math.max(acc, parseCastCode(c)), 0);
  return () => formatCastCode(++max);
}
