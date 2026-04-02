/**
 * Google Analytics 4 (GA4) 共通処理
 * NEXT_PUBLIC_GA_ID が未設定のときは何もしない
 */

declare global {
  interface Window {
    gtag?: (
      command: "config" | "event" | "js",
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function getGaId(): string | undefined {
  if (typeof window === "undefined") return GA_ID;
  return process.env.NEXT_PUBLIC_GA_ID;
}

export function isGaEnabled(): boolean {
  return Boolean(getGaId());
}

/** ページビュー送信（ルート変更時用） */
export function pageview(path: string): void {
  const id = getGaId();
  if (!id || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", id, { page_path: path });
}

/** 汎用イベント送信 */
export function event(
  name: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  const id = getGaId();
  if (!id || typeof window === "undefined" || !window.gtag) return;
  const safe = params
    ? Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== undefined && v !== null && v !== ""
        )
      )
    : undefined;
  window.gtag("event", name, safe);
}

// --- 指定イベント名のラッパー ---

export function clickMap(locationName: string): void {
  event("click_map", { location_name: locationName });
}

export function clickLine(locationName: string): void {
  event("click_line", { location_name: locationName });
}

export function clickTel(locationName: string): void {
  event("click_tel", { location_name: locationName });
}

export function clickSns(snsType: string, locationName: string): void {
  event("click_sns", { sns_type: snsType, location_name: locationName });
}

export function clickCast(castName: string): void {
  event("click_cast", { cast_name: castName });
}
