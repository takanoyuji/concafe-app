"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, Suspense } from "react";
import { getGAId, pageview } from "@/lib/analytics";

function GoogleAnalyticsInner() {
  const pathname = usePathname();
  // 初回ページビューは gtag.js 自身（send_page_view: true）が送るため、
  // ここでの送信は2回目以降（クライアント遷移）に限定する。
  // ※初回は afterInteractive より effect が先に走り window.gtag が未定義でもある
  const isFirstRender = useRef(true);

  useEffect(() => {
    const id = getGAId();
    if (!id || !pathname) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    pageview(pathname);
  }, [pathname]);

  const gaId = getGAId();
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}

export default function GoogleAnalytics() {
  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsInner />
    </Suspense>
  );
}
