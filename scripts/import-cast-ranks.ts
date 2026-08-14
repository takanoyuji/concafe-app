/**
 * CSVからキャストのランクデータをインポートするスクリプト
 *
 * 対象CSV:
 * - 星狼_キャスト.csv → 東京（キャスト名 = tokyoAirRegi）
 * - 星狼名古屋_キャスト.csv → 名古屋（キャスト名 = nagoyaAirRegi）
 * - 星狼大阪_キャスト.csv → 大阪（キャスト名 = osakaAirRegi）
 *
 * 使い方: npx tsx scripts/import-cast-ranks.ts [year] [month]
 * 環境変数: CSV_DIR でCSVのディレクトリを指定（デフォルト: /data/import）
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const CSV_DIR = process.env.CSV_DIR ?? "/data/import";

const CSV_FILES: { file: string; field: "tokyoAirRegi" | "nagoyaAirRegi" | "osakaAirRegi"; label: string }[] = [
  { file: "星狼_キャスト.csv", field: "tokyoAirRegi", label: "東京" },
  { file: "星狼名古屋_キャスト.csv", field: "nagoyaAirRegi", label: "名古屋" },
  { file: "星狼大阪_キャスト.csv", field: "osakaAirRegi", label: "大阪" },
];

function decodeFile(buf: Buffer): string {
  // UTF-8 BOM check
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.toString("utf-8").replace(/^\uFEFF/, "");
  }
  // Try Shift-JIS
  const sjis = new TextDecoder("shift-jis").decode(buf);
  const geta = (sjis.match(/\uFFFD/g) ?? []).length;
  return geta > 3 ? buf.toString("utf-8") : sjis;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

/** NFD→NFC正規化してファイルを探す */
function findFile(dir: string, targetNFC: string): string | null {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir)) {
    if (entry.normalize("NFC") === targetNFC) {
      return path.join(dir, entry);
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const year = args[0] ? parseInt(args[0], 10) : new Date().getFullYear();
  const month = args[1] ? parseInt(args[1], 10) : new Date().getMonth() + 1;

  console.log(`インポート対象: ${year}年${month}月`);
  console.log(`CSV_DIR: ${CSV_DIR}`);

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });

  try {
    const masters = await prisma.cast.findMany();
    console.log(`CastMaster: ${masters.length}件`);

    let totalMatched = 0;
    let totalSkipped = 0;

    for (const { file, field, label } of CSV_FILES) {
      const csvPath = findFile(CSV_DIR, file);
      if (!csvPath) {
        console.log(`[${label}] ファイルが見つかりません: ${file} in ${CSV_DIR}`);
        continue;
      }

      const buf = fs.readFileSync(csvPath);
      const text = decodeFile(buf);
      const rows = parseCsv(text);
      console.log(`\n[${label}] ${file}: ${rows.length}行`);

      let matched = 0;
      let skipped = 0;

      for (const row of rows) {
        const castName = row["キャスト名"] ?? "";
        const rank = row["ランク"] ?? "";
        if (!castName || !rank) { skipped++; continue; }

        const master = masters.find((m) => m[field] === castName);
        if (!master) {
          console.log(`  スキップ: "${castName}" (${field}に一致するマスタなし)`);
          skipped++;
          continue;
        }

        await prisma.cast.update({
          where: { id: master.id },
          data: { rank },
        });

        await prisma.castMonthlyRank.upsert({
          where: { castId_year_month: { castId: master.id, year, month } },
          update: { rank },
          create: { castId: master.id, year, month, rank },
        });

        console.log(`  ✓ ${castName} → ${master.name || master.id} : ${rank}`);
        matched++;
      }

      console.log(`  [${label}] マッチ: ${matched}件, スキップ: ${skipped}件`);
      totalMatched += matched;
      totalSkipped += skipped;
    }

    console.log(`\n合計: マッチ ${totalMatched}件, スキップ ${totalSkipped}件`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
