import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySyncToken } from "@/lib/syncAuth";

export const dynamic = "force-dynamic";

// GET /api/sync/cast-master
//   Authorization: Bearer <SYNC_API_TOKEN>
//   ?activeOnly=true  … 現役のみ（既定は退職者も含む全件）
//
// remodri など外部システムがキャストマスタを取り込むための読み取り専用エンドポイント。
// 退職者も既定で返すのは、外部側に過去の記録が残っており表示名の解決に必要なため。
// 書き込みはこの経路では一切受け付けない（キャストマスタの変更は xing-lang 側が唯一の窓口）。
export async function GET(req: Request) {
  if (!verifySyncToken(req))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("activeOnly") === "true";

  const casts = await prisma.castMaster.findMany({
    where: activeOnly ? { retired: false } : {},
    orderBy: { castCode: "asc" },
    select: {
      castCode: true,
      hpName: true,
      rank: true,
      retired: true,
      tokyoAirRegi: true,
      tokyoAirShift: true,
      osakaAirRegi: true,
      osakaAirShift: true,
      nagoyaAirRegi: true,
      nagoyaAirShift: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    { casts, count: casts.length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
