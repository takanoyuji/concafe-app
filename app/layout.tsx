import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "星狼 | 男装BLコンカフェ",
  description: "男装BLコンカフェ「星狼」公式サイト。東京・大阪・名古屋に展開中。",
  openGraph: {
    title: "星狼 | 男装BLコンカフェ",
    description: "男装BLコンカフェ「星狼」公式サイト",
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
