import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSalary, type CastInput } from "@/lib/salary";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const store = formData.get("store") as string | null;
  const salesFile = formData.get("salesCsv") as File | null;
  const wageFile = formData.get("wageCsv") as File | null;

  if (!store || !salesFile || !wageFile) {
    return NextResponse.json(
      { error: "store, salesCsv, wageCsv は必須です" },
      { status: 400 }
    );
  }

  // DBからキャスト情報を取得（指定店舗のキャスト）
  const storeRecord = await prisma.store.findFirst({ where: { name: store } });
  if (!storeRecord) {
    return NextResponse.json({ error: `店舗「${store}」が見つかりません` }, { status: 404 });
  }

  const [dbCasts, castRanks] = await Promise.all([
    prisma.cast.findMany({
      where: { storeId: storeRecord.id },
      select: { name: true, airShiftName: true, rank: true, exemptFromCommuteRule: true },
    }),
    prisma.castRank.findMany(),
  ]);

  const rankMap = new Map(castRanks.map(r => [r.name, r.backRate]));

  const casts: CastInput[] = dbCasts
    .filter(c => c.airShiftName)
    .map(c => ({
      castName: c.name,
      airShiftName: c.airShiftName!,
      rank: c.rank ?? "",
      backRate: rankMap.get(c.rank ?? "") ?? 0,
      exemptFromCommuteRule: c.exemptFromCommuteRule,
    }));

  const salesBuf = await salesFile.arrayBuffer();
  const wageBuf = await wageFile.arrayBuffer();

  const summary = calculateSalary(salesBuf, wageBuf, casts);

  return NextResponse.json({ summary });
}
