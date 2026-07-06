import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const items = await prisma.menuItem.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { imageUrl, alt, order } = body;
  if (!imageUrl || !alt) {
    return NextResponse.json({ error: "imageUrl と alt は必須です" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: { imageUrl, alt, order: order ?? 0 },
  });
  return NextResponse.json({ item }, { status: 201 });
}
