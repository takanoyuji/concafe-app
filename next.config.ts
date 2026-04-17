import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 本番でリバースプロキシ越しに CSS/JS が確実に読まれるようにする
  assetPrefix:
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_BASE_URL
      ? process.env.NEXT_PUBLIC_BASE_URL
      : undefined,
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
  // nginxなどのリバースプロキシがHTMLをキャッシュしてJS URLが古くなるのを防ぐ
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|images|favicon\\.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
