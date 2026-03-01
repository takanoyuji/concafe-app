import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      casts: { orderBy: { order: "asc" } },
    },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ store });
}
