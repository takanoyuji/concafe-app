"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { pageview } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

/** ルート変更時のページビュー送信のみ。gtag の読み込み・初回 config は layout の head で行う */
export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ID || !pathname) return;
    pageview(pathname);
  }, [pathname]);

  return null;
}
