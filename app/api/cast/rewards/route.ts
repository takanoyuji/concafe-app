import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDisabledUser } from "@/lib/authz";
import { getCastByUserId, castRewardsByMonth, recentMonths } from "@/lib/castPortal";

/**
 * GET /api/cast/rewards — ログイン中のキャスト本人の報酬（当月＋過去12ヶ月）。
 * castId はクエリで受けない。セッションから引いた本人分だけ返す（要件書 2章・10章）
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "CAST" || (await isDisabledUser(session.userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const cast = await getCastByUserId(session.userId);
  if (!cast) return NextResponse.json({ error: "キャスト情報が結ばれていません。店舗に連絡してください" }, { status: 404 });

  const months = await castRewardsByMonth(cast, recentMonths(13));
  return NextResponse.json({ castName: cast.name, months });
}
