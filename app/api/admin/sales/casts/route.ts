import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { castMonthlySales, jstToday } from "@/lib/castPortal";

/** GET /api/admin/sales/casts?year=&month= — キャスト別の月次売上（管理側。cast_sales 権限） */
export async function GET(req: Request) {
  const session = await requireFeature("cast_sales");
  if (session instanceof Response) return session;
  const sp = new URL(req.url).searchParams;
  const now = jstToday();
  const year = Number(sp.get("year") ?? now.year);
  const month = Number(sp.get("month") ?? now.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2023 || year > now.year + 1) {
    return NextResponse.json({ error: "年月が正しくありません" }, { status: 400 });
  }
  const { rows, asOf } = await castMonthlySales(year, month);
  return NextResponse.json({ year, month, rows, asOf, myCastCode: null });
}
