import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const { id } = await params;
  const body = await req.json();
  const { name, backRate, order, hourlyWage, commutePaid } = body;

  const rank = await prisma.castRank.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(backRate != null && { backRate: Number(backRate) }),
      ...(order != null && { order: Number(order) }),
      ...(hourlyWage != null && { hourlyWage: Math.max(0, Math.round(Number(hourlyWage))) }),
      ...(commutePaid != null && { commutePaid: Boolean(commutePaid) }),
    },
  });
  return NextResponse.json({ rank });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("salary");
  if (session instanceof Response) return session;

  const { id } = await params;
  await prisma.castRank.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
