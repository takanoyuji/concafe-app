import { prisma } from "@/lib/prisma";
import {
  listRawDays,
  readRawDay,
  rawDir,
  AirRegiFormatError,
  type ParsedDay,
} from "@/lib/airregi";

/**
 * 生JSONを DB へ取り込む。
 *
 * 営業日単位で「まるごと削除 → 入れ直し」する。会計金額修正・伝票削除が後日発生するため、
 * 同じ営業日を何度取り込んでも最後の結果に収束する必要がある（冪等）。
 * 1営業日あたり数件〜数十件なので、差分更新にする価値はない。
 *
 * ⚠️ 生JSONの storeNo が Store.airRegiStoreNo と一致しない日は取り込まない。
 * 2026-08-16 に、名古屋のCSVで東京の給与計算が保存され、東京のキャスト17人が
 * 全員0円になった事故がある。あれと同じ「別店舗のデータが混ざる」失敗を
 * データ層で止めるための照合。
 */

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  details: { storeSlug: string; businessDate: string; status: string; message: string }[];
}

export interface ImportOptions {
  /** 取り込む営業日の下限 YYYYMMDD。省略時は全部 */
  from?: string;
  /** 台帳より新しいファイルだけ取り込む既定を無視して、全部入れ直す */
  force?: boolean;
  dir?: string;
}

export async function importAirRegiRaw(opts: ImportOptions = {}): Promise<ImportResult> {
  const dir = opts.dir ?? rawDir();
  const days = listRawDays(dir).filter(d => !opts.from || d.businessDate >= opts.from);

  const stores = await prisma.store.findMany({ select: { slug: true, airRegiStoreNo: true } });
  const expectedNo = new Map(stores.map(s => [s.slug, s.airRegiStoreNo]));

  const logs = await prisma.airRegiSyncLog.findMany({
    select: { storeSlug: true, businessDate: true, fetchedAt: true, status: true },
  });
  const logByKey = new Map(logs.map(l => [`${l.storeSlug}/${l.businessDate}`, l]));

  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, details: [] };

  for (const d of days) {
    const key = `${d.storeSlug}/${d.businessDate}`;
    let parsed: ParsedDay;

    try {
      parsed = readRawDay(d.file, d.storeSlug, d.businessDate);
    } catch (e) {
      const message = e instanceof AirRegiFormatError ? e.message : String(e);
      await recordFailure(d.storeSlug, d.businessDate, message);
      result.failed++;
      result.details.push({ ...d, status: "error", message });
      continue;
    }

    // 取り込み済みで、ファイルが更新されていないなら飛ばす
    const prev = logByKey.get(key);
    if (!opts.force && prev && prev.status === "ok" && prev.fetchedAt >= parsed.fetchedAt) {
      result.skipped++;
      continue;
    }

    // 店舗番号の照合。未設定(空文字)の店舗は連携対象外として飛ばす
    const want = expectedNo.get(d.storeSlug);
    if (want === undefined) {
      const message = `Store に slug=${d.storeSlug} がありません`;
      await recordFailure(d.storeSlug, d.businessDate, message);
      result.failed++;
      result.details.push({ ...d, status: "error", message });
      continue;
    }
    if (!want) {
      result.skipped++;
      continue;
    }
    const wrong = parsed.storeNos.filter(n => n !== want);
    if (wrong.length > 0) {
      const message =
        `店舗番号が一致しません。期待 ${want} / 実際 ${wrong.join(",")}。` +
        `別店舗のAPIキーで取得された可能性があるため取り込みません`;
      await recordFailure(d.storeSlug, d.businessDate, message);
      result.failed++;
      result.details.push({ ...d, status: "error", message });
      continue;
    }

    // 営業日はファイル名だけでなく取引1件ずつでも確認する。
    // ズレた取引が混ざると期間の切り出しが静かに狂う
    const strayDate = parsed.transactions.find(t => t.businessDate !== d.businessDate);
    if (strayDate) {
      const message = `営業日 ${strayDate.businessDate} の取引が ${d.businessDate} のファイルに入っています`;
      await recordFailure(d.storeSlug, d.businessDate, message);
      result.failed++;
      result.details.push({ ...d, status: "error", message });
      continue;
    }

    await prisma.$transaction(async tx => {
      // 営業日ぶんをまるごと消してから入れ直す（明細と支払は onDelete: Cascade で消える）
      await tx.airRegiTransaction.deleteMany({
        where: { storeSlug: d.storeSlug, businessDate: d.businessDate },
      });

      for (const t of parsed.transactions) {
        await tx.airRegiTransaction.create({
          data: {
            storeNo: t.storeNo,
            storeSlug: t.storeSlug,
            airRegiTransactionId: t.airRegiTransactionId,
            transactionType: t.transactionType,
            canceledFlg: t.canceledFlg,
            businessDate: t.businessDate,
            transactionDateTime: t.transactionDateTime,
            voucherNo: t.voucherNo,
            totalAmount: t.totalAmount,
            taxAmount: t.taxAmount,
            discountAmount: t.discountAmount,
            fetchedAt: parsed.fetchedAt,
            orders: { create: t.orders },
            payments: { create: t.payments },
          },
        });
      }

      await tx.airRegiSyncLog.upsert({
        where: { storeSlug_businessDate: { storeSlug: d.storeSlug, businessDate: d.businessDate } },
        create: {
          storeSlug: d.storeSlug,
          businessDate: d.businessDate,
          status: "ok",
          transactionCount: parsed.transactions.length,
          message: "",
          fetchedAt: parsed.fetchedAt,
        },
        update: {
          status: "ok",
          transactionCount: parsed.transactions.length,
          message: "",
          fetchedAt: parsed.fetchedAt,
          importedAt: new Date(),
        },
      });
    });

    result.imported++;
    result.details.push({ ...d, status: "ok", message: `取引${parsed.transactions.length}件` });
  }

  return result;
}

async function recordFailure(storeSlug: string, businessDate: string, message: string): Promise<void> {
  await prisma.airRegiSyncLog.upsert({
    where: { storeSlug_businessDate: { storeSlug, businessDate } },
    create: { storeSlug, businessDate, status: "error", message, fetchedAt: new Date(0) },
    update: { status: "error", message, importedAt: new Date() },
  });
}

/**
 * 取り込めていない営業日を返す。
 *
 * cron が静かに止まったこと、特定の日だけ失敗したことに気づくための一覧。
 * 「ファイルが無い」も「取り込みでエラーになった」も、どちらも欠けとして扱う。
 * 当日は営業が終わっていないので数えない。
 */
export async function findMissingDays(days = 45): Promise<{ storeSlug: string; businessDate: string; reason: string }[]> {
  const stores = await prisma.store.findMany({
    where: { airRegiStoreNo: { not: "" } },
    select: { slug: true },
    orderBy: { slug: "asc" },
  });

  const wanted: string[] = [];
  const today = new Date();
  for (let i = days; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    wanted.push(
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
    );
  }

  const logs = await prisma.airRegiSyncLog.findMany({
    where: { businessDate: { gte: wanted[0]! } },
    select: { storeSlug: true, businessDate: true, status: true, message: true },
  });
  const byKey = new Map(logs.map(l => [`${l.storeSlug}/${l.businessDate}`, l]));

  const missing: { storeSlug: string; businessDate: string; reason: string }[] = [];
  for (const s of stores) {
    for (const bd of wanted) {
      const l = byKey.get(`${s.slug}/${bd}`);
      if (!l) missing.push({ storeSlug: s.slug, businessDate: bd, reason: "未取得" });
      else if (l.status !== "ok") missing.push({ storeSlug: s.slug, businessDate: bd, reason: l.message || "取り込み失敗" });
    }
  }
  return missing;
}
