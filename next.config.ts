import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
    remotePatterns: [],
  },
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
};

export default nextConfig;
