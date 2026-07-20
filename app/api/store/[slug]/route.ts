import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_CAST_WHERE } from "@/lib/cast";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      // 非公開キャストと給与情報は返さない
      casts: {
        where: PUBLIC_CAST_WHERE,
        select: {
          id: true, name: true, bio: true, imageUrl: true, storeId: true, order: true,
          twitterUrl: true, instagramUrl: true, tiktokUrl: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ store });
}
