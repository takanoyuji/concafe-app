import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importAirRegiRaw, findMissingDays } from "@/lib/airregiImport";

/**
 * Airレジの生JSONをDBへ取り込む。
 *
 * 呼び出し元は2つ:
 *   - cron（Bearer CRON_SECRET）… scripts/airregi-fetch.sh の直後に叩く
 *   - 管理画面のADMIN（Cookieセッション）… 手で取り込み直したいとき
 *
 * timeout を避けるため、既定では台帳より新しいファイルだけ取り込む。
 * 全部入れ直したいときは ?force=1。
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const byCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!byCron) {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const from = url.searchParams.get("from") ?? undefined;
  if (from && !/^\d{8}$/.test(from)) {
    return NextResponse.json({ error: "from は YYYYMMDD で指定してください" }, { status: 400 });
  }

  const result = await importAirRegiRaw({ force, from });
  const missing = await findMissingDays();

  // 取り込み失敗があれば 207 で返す。cron 側が終了コードで気づけるようにするため
  const status = result.failed > 0 ? 207 : 200;
  return NextResponse.json({ ...result, missing }, { status });
}

/** 取り込み状況の確認だけ。管理画面が「取れていない営業日」を出すのに使う */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const missing = await findMissingDays();
  return NextResponse.json({ missing });
}
