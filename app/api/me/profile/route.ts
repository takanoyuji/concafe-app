import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const { name, favoriteStoreId, favoriteCast1Id, favoriteCast2Id } = body as {
    name?: string;
    favoriteStoreId?: string;
    favoriteCast1Id?: string;
    favoriteCast2Id?: string;
  };

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "名前は必須です" }, { status: 400 });
  }
  if (name.trim().length > 20) {
    return NextResponse.json({ error: "名前は20文字以内で入力してください" }, { status: 400 });
  }

  // 推しキャストの重複チェック
  if (
    favoriteCast1Id &&
    favoriteCast2Id &&
    favoriteCast1Id === favoriteCast2Id
  ) {
    return NextResponse.json({ error: "推しキャストに同じキャストを2つ設定することはできません" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      name: name.trim(),
      favoriteStoreId: favoriteStoreId || null,
      favoriteCast1Id: favoriteCast1Id || null,
      favoriteCast2Id: favoriteCast2Id || null,
    },
  });

  return NextResponse.json({ message: "プロフィールを更新しました" });
}
