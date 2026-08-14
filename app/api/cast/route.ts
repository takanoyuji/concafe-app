import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CastSchema } from "@/lib/validations";
import { PUBLIC_CAST_WHERE, setPrimaryStore } from "@/lib/cast";
import { createCastCodeAllocator } from "@/lib/castCode";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  // 非公開キャストは管理者が明示的に要求したときだけ返す
  // （管理者がギフト・推し選択画面を開いたときに混ざらないようにするため）
  const includeHidden = isAdmin && req.nextUrl.searchParams.get("includeHidden") === "1";
  const casts = await prisma.cast.findMany({
    where: includeHidden ? undefined : PUBLIC_CAST_WHERE,
    select: {
      id: true, name: true, bio: true, imageUrl: true,
      order: true, isPublished: true,
      twitterUrl: true, instagramUrl: true, tiktokUrl: true,
      createdAt: true, updatedAt: true,
      // 掛け持ちがあるので所属店舗は配列で返す。isPrimary が主たる店舗
      stores: {
        select: { isPrimary: true, store: { select: { id: true, name: true, slug: true } } },
        orderBy: { isPrimary: "desc" },
      },
      // 給与情報とコード・退職状態は管理者のみ返す
      ...(isAdmin && {
        castCode: true, retired: true,
        airShiftName: true, rank: true, exemptFromCommuteRule: true,
      }),
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  // 主たる店舗を storeId / store として返し、これまでの形と互換を保つ
  return NextResponse.json({
    casts: casts.map(({ stores, ...cast }) => ({
      ...cast,
      storeId: stores.find(s => s.isPrimary)?.store.id ?? stores[0]?.store.id ?? null,
      store: stores.find(s => s.isPrimary)?.store ?? stores[0]?.store ?? null,
      stores: stores.map(s => ({ ...s.store, isPrimary: s.isPrimary })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CastSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    // 画面からは店舗を1つ選ぶ形なので、それを主たる所属店舗として保存する
    const { storeId, ...castData } = parsed.data;
    const cast = await prisma.$transaction(async tx => {
      const existing = await tx.cast.findMany({ select: { castCode: true } });
      const allocate = createCastCodeAllocator(existing.map(c => c.castCode));
      const created = await tx.cast.create({ data: { ...castData, castCode: allocate() } });
      await setPrimaryStore(tx, created.id, storeId);
      return created;
    });
    return NextResponse.json({ cast }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
