import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireFeature("points");
  if (session instanceof Response) return session;

  const { id } = await params;
  const body = await req.json();

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(typeof body.ageVerified === "boolean" ? { ageVerified: body.ageVerified } : {}),
    },
    select: { id: true, email: true, ageVerified: true },
  });

  return NextResponse.json({ user });
}
