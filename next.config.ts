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
};

export default nextConfig;
