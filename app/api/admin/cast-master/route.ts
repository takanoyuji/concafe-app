import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const masters = await prisma.castMaster.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ masters });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const master = await prisma.castMaster.create({ data: body });
  return NextResponse.json({ master }, { status: 201 });
}
