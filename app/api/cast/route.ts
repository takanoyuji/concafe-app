import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CastSchema } from "@/lib/validations";

export async function GET() {
  const casts = await prisma.cast.findMany({
    include: { store: { select: { id: true, name: true, slug: true } } },
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
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const cast = await prisma.cast.create({ data: parsed.data });
  return NextResponse.json({ cast }, { status: 201 });
}
