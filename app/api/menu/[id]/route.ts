import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/authz";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireFeature("menu");
  if (session instanceof Response) return session;

  const { id } = await params;
  const body = await req.json();
  const { imageUrl, alt, order } = body;

  const item = await prisma.menuItem.update({
    where: { id },
    data: {
      ...(imageUrl !== undefined ? { imageUrl } : {}),
      ...(alt !== undefined ? { alt } : {}),
      ...(order !== undefined ? { order } : {}),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireFeature("menu");
  if (session instanceof Response) return session;

  const { id } = await params;
  await prisma.menuItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
