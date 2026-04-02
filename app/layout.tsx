import type { Metadata } from "next";
import "./globals.css";
import ScrollInit from "@/components/ui/ScrollInit";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://vliverlab.com"),
  title: {
    default: "VLiverLab | VTuberと話せる近未来Cafe&Bar",
    template: "%s | VLiverLab",
  },
  description:
    "VTuberとお話しながらお酒を楽しめる新感覚コンセプトカフェ＆バー。大阪梅田・東京池袋で営業中。",
  keywords: [
    "VTuber",
    "VLiverLab",
    "コンカフェ",
    "近未来カフェ",
    "ホログラフィック",
    "バーチャルライバー",
    "VTuberカフェ",
    "大阪梅田",
    "東京池袋",
    "コンセプトカフェ",
    "vliverlab",
    "Cafe Bar",
  ],
  openGraph: {
    title: "VLiverLab | VTuberと話せる近未来Cafe&Bar",
    description:
      "VTuberとお話しながらお酒を楽しめる新感覚コンセプトカフェ＆バー。大阪梅田・東京池袋で営業中。",
    locale: "ja_JP",
    type: "website",
    siteName: "VLiverLab",
    url: "https://vliverlab.com",
    images: [
      {
        url: "/images/vll_logo.png",
        width: 834,
        height: 681,
        alt: "VLiverLab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VLiverLab | VTuberと話せる近未来Cafe&Bar",
    description:
      "VTuberとお話しながらお酒を楽しめる新感覚コンセプトカフェ＆バー。大阪梅田・東京池袋で営業中。",
    images: ["/images/vll_logo.png"],
  },
  robots: { index: true, follow: true },
};

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&family=Noto+Sans+JP:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {GA_ID ? (
          <>
            {/* デプロイ確認: ページのソースで "vll-ga-id" を検索して ID が出ればこのビルドが動いている */}
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${GA_ID.replace(/'/g, "\\'")}', {send_page_view: true});/* vll-ga-id: ${GA_ID} */`,
              }}
            />
          </>
        ) : null}
      </head>
      <body className="antialiased">
        <GoogleAnalytics />
        {children}
        <ScrollInit />
      </body>
    </html>
  );
}
