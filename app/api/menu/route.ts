import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.menuItem.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { category, name, price, note, badge, order } = body;
  if (!category || !name) {
    return NextResponse.json({ error: "カテゴリと名前は必須です" }, { status: 400 });
  }
  const item = await prisma.menuItem.create({
    data: { category, name, price: price || null, note: note || null, badge: badge || null, order: order ?? 0 },
  });
  return NextResponse.json({ item }, { status: 201 });
}
