import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ranks = await prisma.castRank.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json({ ranks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, backRate, order } = body;
  if (!name || backRate == null) {
    return NextResponse.json({ error: "name と backRate は必須です" }, { status: 400 });
  }

  const rank = await prisma.castRank.create({
    data: { name, backRate: Number(backRate), order: Number(order ?? 0) },
  });
  return NextResponse.json({ rank }, { status: 201 });
}
