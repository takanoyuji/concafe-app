import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CastSchema } from "@/lib/validations";
import { PUBLIC_CAST_WHERE, setPrimaryStore } from "@/lib/cast";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN";
  const cast = await prisma.cast.findFirst({
    where: isAdmin ? { id } : { id, ...PUBLIC_CAST_WHERE },
    select: {
      id: true, name: true, bio: true, imageUrl: true,
      order: true, isPublished: true,
      twitterUrl: true, instagramUrl: true, tiktokUrl: true,
      createdAt: true, updatedAt: true,
      stores: {
        select: { isPrimary: true, store: { select: { id: true, name: true, slug: true } } },
        orderBy: { isPrimary: "desc" },
      },
      // rank / airShiftName / exemptFromCommuteRule は除外（給与情報）
    },
  });
  if (!cast) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // これまで通り storeId / store も返して、利用側の形を変えない
  const { stores, ...rest } = cast;
  const primary = stores.find(s => s.isPrimary) ?? stores[0];
  return NextResponse.json({
    cast: {
      ...rest,
      storeId: primary?.store.id ?? null,
      store: primary?.store ?? null,
      stores: stores.map(s => ({ ...s.store, isPrimary: s.isPrimary })),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = CastSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、");
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const { storeId, ...castData } = parsed.data;
    const cast = await prisma.$transaction(async tx => {
      const updated = await tx.cast.update({ where: { id }, data: castData });
      await setPrimaryStore(tx, id, storeId);
      return updated;
    });
    return NextResponse.json({ cast });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: airShiftName / rank / exemptFromCommuteRule のみ部分更新
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("airShiftName" in body) data.airShiftName = body.airShiftName;
  if ("rank"         in body) data.rank          = body.rank;
  if ("exemptFromCommuteRule" in body) data.exemptFromCommuteRule = body.exemptFromCommuteRule;

  const cast = await prisma.cast.update({ where: { id }, data });
  return NextResponse.json({ cast });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.cast.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
