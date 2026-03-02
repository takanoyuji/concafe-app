import type { Metadata } from "next";
import "./globals.css";
import ScrollInit from "@/components/ui/ScrollInit";

export const metadata: Metadata = {
  title: {
    default: "星狼 | 男装コスプレコンカフェ | 池袋・日本橋・名古屋",
    template: "%s | 星狼",
  },
  description:
    "コスプレイヤーだけが働く男装BLコンセプトカフェ「星狼」公式サイト。池袋・大阪日本橋・名古屋錦の3店舗展開。男装コスプレキャストとの特別なひとときを。コンカフェ・男装コンカフェ好き必見。",
  keywords: [
    "コンカフェ",
    "男装",
    "コスプレ",
    "男装コンカフェ",
    "BLカフェ",
    "コンセプトカフェ",
    "男装コスプレ",
    "池袋",
    "日本橋",
    "名古屋",
    "名古屋錦",
    "星狼",
    "xinglang",
    "コスプレイヤー",
    "メンズコスプレ",
  ],
  openGraph: {
    title: "星狼 | 男装コスプレコンカフェ",
    description:
      "コスプレイヤーだけが働く男装BLコンセプトカフェ「星狼」。池袋・日本橋・名古屋の3店舗。男装キャストとの特別な時間をどうぞ。",
    locale: "ja_JP",
    type: "website",
    siteName: "星狼",
  },
  twitter: {
    card: "summary_large_image",
    title: "星狼 | 男装コスプレコンカフェ",
    description: "コスプレイヤーだけが働く男装BLコンセプトカフェ「星狼」。池袋・日本橋・名古屋の3店舗。",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
        <ScrollInit />
      </body>
    </html>
  );
}
