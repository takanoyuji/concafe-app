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
      // 非公開キャストと給与情報は返さない。
      // 掛け持ちのキャストは所属している全店舗のページに出る
      castStores: {
        // 掛け持ちしていても、HPに出るのは主たる店舗のページだけ
        where: { isPrimary: true, cast: PUBLIC_CAST_WHERE },
        select: {
          isPrimary: true,
          cast: {
            select: {
              id: true, name: true, bio: true, imageUrl: true, order: true,
              twitterUrl: true, instagramUrl: true, tiktokUrl: true,
            },
          },
        },
        orderBy: { cast: { order: "asc" } },
      },
    },
  });
  if (!store) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 中間テーブルの存在は外に見せず、これまで通り store.casts の形で返す
  const { castStores, ...rest } = store;
  return NextResponse.json({
    store: { ...rest, casts: castStores.map(cs => ({ ...cs.cast, storeId: store.id })) },
  });
}
