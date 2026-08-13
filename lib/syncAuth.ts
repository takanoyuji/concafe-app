import { timingSafeEqual } from "crypto";

/**
 * サーバー間同期用のトークン認証。
 *
 * 管理画面の API は Cookie セッション認証だが、それは外部サーバーからは使えない。
 * 同期専用の読み取り API だけをこのトークンで通す。
 *
 * SYNC_API_TOKEN が未設定のときは常に拒否する（設定漏れで開けっ放しにしない）。
 */
export function verifySyncToken(req: Request): boolean {
  const expected = process.env.SYNC_API_TOKEN;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!m) return false;

  const given = Buffer.from(m[1]);
  const want = Buffer.from(expected);

  // timingSafeEqual は長さが違うと例外を投げるので、先に長さを比べる
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}
