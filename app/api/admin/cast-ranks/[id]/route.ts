import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, backRate, order } = body;

  const rank = await prisma.castRank.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(backRate != null && { backRate: Number(backRate) }),
      ...(order != null && { order: Number(order) }),
    },
  });
  return NextResponse.json({ rank });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.castRank.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
