import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { TitleSchema } from "@/lib/validations";

export async function GET() {
  const titles = await prisma.title.findMany({ orderBy: { threshold: "asc" } });
  return NextResponse.json({ titles });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = TitleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const title = await prisma.title.create({ data: parsed.data });
  return NextResponse.json({ title }, { status: 201 });
}
