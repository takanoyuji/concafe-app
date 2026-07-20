import { defineConfig } from "vitest/config";
import path from "node:path";

// テスト用DBは dev.db / 本番DBとは別ファイル。globalSetup で作り直す。
const TEST_DB = path.resolve(__dirname, "prisma/test.db");

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    env: { DATABASE_URL: `file:${TEST_DB}` },
    // Prisma の書き込みが競合しないよう直列実行
    fileParallelism: false,
  },
});
