import "dotenv/config";
import { defineConfig } from "prisma/config";

/** lib/prisma.ts と同じ。未設定時はローカル SQLite（プロジェクト直下の dev.db） */
const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
