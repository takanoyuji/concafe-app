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
    dataLayer?: unknown[];
  }
}

export function getGAId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_ID || undefined;
}

export function isGAEnabled(): boolean {
  return !!getGAId();
}

/** ページビュー送信（App Router のクライアント遷移用） */
export function pageview(path: string, title?: string): void {
  const id = getGAId();
  if (!id || typeof window === "undefined" || !window.gtag) return;
  window.gtag("config", id, {
    page_path: path,
    ...(title && { page_title: title }),
  });
}

/** 汎用イベント送信 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
): void {
  const id = getGAId();
  if (!id || typeof window === "undefined" || !window.gtag) return;
  const safeParams = params
    ? Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
      ) as Record<string, string | number | boolean>
    : undefined;
  window.gtag("event", eventName, safeParams);
}

/** Google Map クリック */
export function trackMapClick(locationName: string): void {
  trackEvent("click_map", { location_name: locationName });
}

/** LINE クリック */
export function trackLineClick(locationName: string): void {
  trackEvent("click_line", { location_name: locationName });
}

/** 電話クリック */
export function trackTelClick(locationName: string): void {
  trackEvent("click_tel", { location_name: locationName });
}

/** SNS クリック（sns_type: x | instagram | tiktok | facebook など） */
export function trackSnsClick(snsType: string, locationName: string): void {
  trackEvent("click_sns", { sns_type: snsType, location_name: locationName });
}

/** キャストクリック */
export function trackCastClick(castName: string): void {
  trackEvent("click_cast", { cast_name: castName });
}
