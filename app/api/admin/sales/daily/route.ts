import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { storeDailySales, jstToday, type StorePrefix } from "@/lib/castPortal";

/** GET /api/admin/sales/daily?store=tokyo&year=2026&month=9 — 店舗の日次売上（来店/遠隔）。docs/cast-portal-requirements.md 7章 */
export async function GET(req: Request) {
  const session = await requireFeature("store_sales");
  if (session instanceof Response) return session;

  const sp = new URL(req.url).searchParams;
  const store = sp.get("store") as StorePrefix | null;
  const now = jstToday();
  const year = Number(sp.get("year") ?? now.year);
  const month = Number(sp.get("month") ?? now.month);
  if (!store || !["tokyo", "osaka", "nagoya"].includes(store)) return NextResponse.json({ error: "store は tokyo / osaka / nagoya" }, { status: 400 });
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ error: "年月が正しくありません" }, { status: 400 });

  const { rows, remodriError } = await storeDailySales(store, year, month);
  const total = rows.reduce((a, r) => ({ local: a.local + r.local, remote: a.remote + r.remote, total: a.total + r.total }), { local: 0, remote: 0, total: 0 });
  return NextResponse.json({ store, year, month, rows, total, remodriError: remodriError ?? null });
}
