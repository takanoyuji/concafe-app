import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { castMonthlySales, getCastByUserId, jstToday } from "@/lib/castPortal";

/**
 * GET /api/cast/sales?year=&month= — キャスト全員の月別売上（来店/遠隔/合計）。
 * 報酬・率は含めない（要件書 6章）。CAST のログインが要る
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "CAST") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const me = await getCastByUserId(session.userId);

  const sp = new URL(req.url).searchParams;
  const now = jstToday();
  const year = Number(sp.get("year") ?? now.year);
  const month = Number(sp.get("month") ?? now.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2023 || year > now.year + 1) {
    return NextResponse.json({ error: "年月が正しくありません" }, { status: 400 });
  }
  const { rows, asOf } = await castMonthlySales(year, month);
  return NextResponse.json({ year, month, rows, asOf, myCastCode: me?.castCode ?? null });
}
