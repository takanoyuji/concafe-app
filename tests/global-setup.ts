import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const TEST_DB = path.join(ROOT, "prisma/test.db");

/**
 * テスト用の空DBを作り、マイグレーションを適用する。
 * dev.db / 本番DBには一切触れない。
 */
export default function setup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    fs.rmSync(TEST_DB + suffix, { force: true });
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: "pipe",
  });

  return () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      fs.rmSync(TEST_DB + suffix, { force: true });
    }
  };
}
