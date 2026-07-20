/**
 * 全店舗の月次給与データを一括インポートするスクリプト
 *
 * CSV_DIR 配下の3店舗ディレクトリからバリエーション別売上＋概算人件費のペアを自動検出し、
 * calculateSalary() で計算して SalaryPeriod に保存する。
 *
 * 使い方: npx tsx scripts/import-salary-batch.ts
 * 環境変数:
 *   CSV_DIR  CSVの親ディレクトリ（デフォルト: /data/import）
 *   DRY_RUN  "1" でDB書き込みをスキップ
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { calculateSalary, type CastInput } from "../lib/salary";

const CSV_DIR = process.env.CSV_DIR ?? "/data/import";
const DRY_RUN = process.env.DRY_RUN === "1";

interface StoreConfig {
  dirName: string;       // ディレクトリ名
  storeName: string;     // DB上のstoreName
  prefix: "tokyo" | "osaka" | "nagoya";
  wagePatterns: string[]; // 人件費CSVの店名サフィックス（NFC）
}

const STORES: StoreConfig[] = [
  {
    dirName: "勤怠・商品別売上_東京",
    storeName: "東京",
    prefix: "tokyo",
    wagePatterns: ["星狼"],
  },
  {
    dirName: "勤怠・商品別売上_大阪",
    storeName: "大阪",
    prefix: "osaka",
    wagePatterns: ["星狼大阪店"],
  },
  {
    dirName: "勤怠・商品別売上_名古屋",
    storeName: "名古屋",
    prefix: "nagoya",
    wagePatterns: ["星狼名古屋店", "星狼\u3000名古屋店"], // 全角スペース
  },
];

interface CsvPair {
  year: number;
  month: number;
  half: number; // 0=全体, 1=前半, 2=後半
  salesPath: string;
  wagePath: string;
}

/** NFD正規化されたファイル名を元のパスに変換するマップを作る */
function buildNfcMap(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(dir)) return map;
  for (const entry of fs.readdirSync(dir)) {
    map.set(entry.normalize("NFC"), path.join(dir, entry));
  }
  return map;
}

/** 月次CSVペアを検出する */
function findPairs(storeDir: string, store: StoreConfig): CsvPair[] {
  const nfcMap = buildNfcMap(storeDir);
  const dateRe = /(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/;

  // 売上ファイルを抽出
  const salesFiles = new Map<string, string>(); // dateRange -> path
  for (const [nfc, fullPath] of nfcMap) {
    if (nfc.startsWith("バリエーション別売上_") && nfc.endsWith(".csv") && !nfc.includes("Zone")) {
      const m = nfc.match(dateRe);
      if (m) salesFiles.set(`${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}`, fullPath);
    }
  }

  // 人件費ファイルを抽出
  const wageFiles = new Map<string, string>(); // dateRange -> path
  for (const [nfc, fullPath] of nfcMap) {
    if (nfc.startsWith("概算人件費シミュレーション_") && nfc.endsWith(".csv") && !nfc.includes("Zone")) {
      // 店名サフィックスが一致するか確認
      const matchesStore = store.wagePatterns.some((pat) => nfc.includes(`_${pat}.csv`));
      if (!matchesStore) continue;
      const m = nfc.match(dateRe);
      if (m) wageFiles.set(`${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}`, fullPath);
    }
  }

  // ペアをマッチング
  const pairs: CsvPair[] = [];
  for (const [dateRange, salesPath] of salesFiles) {
    const wagePath = wageFiles.get(dateRange);
    if (!wagePath) continue;

    const m = dateRange.match(/(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
    if (!m) continue;

    const [, sy, sm, sd, , em, ed] = m;
    const year = parseInt(sy, 10);
    const month = parseInt(sm, 10);
    const startDay = parseInt(sd, 10);
    const endDay = parseInt(ed, 10);
    const endMonth = parseInt(em, 10);

    if (endMonth !== month) continue; // 月をまたぐデータはスキップ

    let half: number;
    if (startDay === 1 && endDay >= 28) {
      half = 0; // 全体
    } else if (startDay === 1 && endDay === 15) {
      half = 1; // 前半
    } else if (startDay === 16 && endDay >= 28) {
      half = 2; // 後半
    } else {
      continue; // 週次等はスキップ
    }

    pairs.push({ year, month, half, salesPath, wagePath });
  }

  // 同月に全体と前半/後半の両方がある場合、全体を優先
  const monthMap = new Map<string, CsvPair[]>();
  for (const p of pairs) {
    const key = `${p.year}-${p.month}`;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(p);
  }

  const result: CsvPair[] = [];
  for (const monthPairs of monthMap.values()) {
    const fullMonth = monthPairs.find((p) => p.half === 0);
    if (fullMonth) {
      result.push(fullMonth);
    } else {
      result.push(...monthPairs);
    }
  }

  return result.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month) || a.half - b.half);
}

async function main() {
  console.log(`CSV_DIR: ${CSV_DIR}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  const prisma = new PrismaClient({ adapter });

  try {
    const [masters, castRanks] = await Promise.all([
      prisma.castMaster.findMany(),
      prisma.castRank.findMany(),
    ]);

    console.log(`CastMaster: ${masters.length}件, CastRank: ${castRanks.length}件`);
    const rankMap = new Map(castRanks.map((r) => [r.name, r.backRate] as [string, number]));

    // hpNameマップ（全prefix分を準備）
    const hpNameMaps: Record<string, Map<string, string>> = {};
    for (const store of STORES) {
      const regiField = `${store.prefix}AirRegi` as keyof (typeof masters)[0];
      hpNameMaps[store.prefix] = new Map(
        masters.map((m) => [String(m[regiField] || ""), m.hpName] as [string, string])
      );
    }

    let totalPairs = 0;
    let totalSaved = 0;

    for (const store of STORES) {
      const storeDir = findDir(CSV_DIR, store.dirName);
      if (!storeDir) {
        console.log(`\n[${store.storeName}] ディレクトリが見つかりません: ${store.dirName}`);
        continue;
      }

      const pairs = findPairs(storeDir, store);
      console.log(`\n[${store.storeName}] ${pairs.length}ペア検出`);
      totalPairs += pairs.length;

      const regiField = `${store.prefix}AirRegi` as keyof (typeof masters)[0];
      const shiftField = `${store.prefix}AirShift` as keyof (typeof masters)[0];

      for (const pair of pairs) {
        const halfLabel = pair.half === 0 ? "全体" : pair.half === 1 ? "前半" : "後半";
        const label = `${pair.year}/${String(pair.month).padStart(2, "0")} ${halfLabel}`;

        // CastInput構築
        const casts: CastInput[] = masters
          .filter((m) => !m.retired && (m[regiField] || m[shiftField]))
          .map((m) => ({
            castName: String(m[regiField] || ""),
            airShiftName: String(m[shiftField] || ""),
            rank: m.rank,
            backRate: rankMap.get(m.rank) ?? 0,
            exemptFromCommuteRule: false,
          }))
          .filter((c) => c.castName || c.airShiftName);

        try {
          const salesBuf = fs.readFileSync(pair.salesPath);
          const wageBuf = fs.readFileSync(pair.wagePath);

          const salesArrayBuf = salesBuf.buffer.slice(salesBuf.byteOffset, salesBuf.byteOffset + salesBuf.byteLength);
          const wageArrayBuf = wageBuf.buffer.slice(wageBuf.byteOffset, wageBuf.byteOffset + wageBuf.byteLength);

          const summary = calculateSalary(salesArrayBuf, wageArrayBuf, casts);

          if (DRY_RUN) {
            console.log(`  [DRY] ${label}: 売上¥${Math.round(summary.totalSalesTaxIncl).toLocaleString()} キャスト${summary.casts.length}人`);
            continue;
          }

          // 既存データを削除→再作成（全体の場合は前半/後半も削除）
          const deleteTargets = pair.half === 0
            ? await prisma.salaryPeriod.findMany({ where: { storeName: store.storeName, year: pair.year, month: pair.month } })
            : await prisma.salaryPeriod.findMany({ where: { storeName: store.storeName, year: pair.year, month: pair.month, half: pair.half } });
          for (const d of deleteTargets) {
            await prisma.salaryPeriod.delete({ where: { id: d.id } });
          }

          const hpMap = hpNameMaps[store.prefix];
          await prisma.salaryPeriod.create({
            data: {
              storeName: store.storeName,
              year: pair.year,
              month: pair.month,
              half: pair.half,
              castRecords: {
                create: summary.casts.map((c) => ({
                  castName: c.castName,
                  hpName: hpMap.get(c.castName) ?? "",
                  rank: c.rank,
                  basicPay: c.basicPay,
                  commute: c.commute,
                  back: c.back,
                  payment: c.payment,
                  grossProfit: c.grossProfit,
                  totalSales: c.totalSales,
                })),
              },
              summaryRecord: {
                create: {
                  totalSalesTaxIncl: summary.totalSalesTaxIncl,
                  remoteSales: summary.remoteSales,
                  localSales: summary.localSales,
                  taxAmount: summary.taxAmount,
                  grossProfit: summary.grossProfit,
                  purchases: summary.purchases,
                  castPay: summary.castPay,
                  laborCost: summary.laborCost,
                  contributionProfit: summary.contributionProfit,
                  workHours: summary.workHours,
                },
              },
            },
          });

          console.log(`  ✓ ${label}: 売上¥${Math.round(summary.totalSalesTaxIncl).toLocaleString()} 貢献利益¥${Math.round(summary.contributionProfit).toLocaleString()} キャスト${summary.casts.length}人`);
          totalSaved++;
        } catch (err) {
          console.error(`  ✗ ${label}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    console.log(`\n合計: ${totalPairs}ペア検出, ${totalSaved}件保存`);
  } finally {
    await prisma.$disconnect();
  }
}

/** NFD正規化されたディレクトリを探す */
function findDir(parent: string, targetNFC: string): string | null {
  if (!fs.existsSync(parent)) return null;
  for (const entry of fs.readdirSync(parent)) {
    if (entry.normalize("NFC") === targetNFC && fs.statSync(path.join(parent, entry)).isDirectory()) {
      return path.join(parent, entry);
    }
  }
  return null;
}

main().catch((e) => { console.error(e); process.exit(1); });
