import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CastSchema } from "@/lib/validations";
import { PUBLIC_CAST_WHERE } from "@/lib/cast";

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
      storeId: true, order: true, isPublished: true,
      twitterUrl: true, instagramUrl: true, tiktokUrl: true,
      createdAt: true, updatedAt: true,
      store: { select: { id: true, name: true, slug: true } },
      // 給与情報は管理者のみ返す
      ...(isAdmin && { airShiftName: true, rank: true, exemptFromCommuteRule: true }),
    },
    orderBy: [{ storeId: "asc" }, { order: "asc" }],
  });
  return NextResponse.json({ casts });
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
    const cast = await prisma.cast.create({ data: parsed.data });
    return NextResponse.json({ cast }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
