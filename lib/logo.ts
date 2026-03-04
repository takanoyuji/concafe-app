/**
 * ロゴ画像（ビルド時に app/assets/logo.jpg から取り込まれる。Docker では Dockerfile の RUN で生成）
 */
import logo from "@/app/assets/logo.jpg";

export const logoUrl = logo.src;
export const logoWidth = logo.width;
export const logoHeight = logo.height;
