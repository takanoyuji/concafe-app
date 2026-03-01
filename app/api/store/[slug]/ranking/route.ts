import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCastRanking } from "@/lib/points";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ranking = await getCastRanking(store.id);
  return NextResponse.json({ ranking });
}
