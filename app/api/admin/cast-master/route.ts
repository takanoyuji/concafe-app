import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { createCastCodeAllocator } from "@/lib/castCode";

export async function GET() {
  const session = await requireFeature("cast");
  if (session instanceof Response) return session;

  const masters = await prisma.cast.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ masters });
}

export async function POST(req: Request) {
  const session = await requireFeature("cast");
  if (session instanceof Response) return session;

  const body = await req.json();

  // 受け付ける項目を明示する。castCode はここでは受け取らず、必ずサーバー側で採番する
  const data = {
    name:         body.name         ?? "",
    rank:           body.rank           ?? "",
    retired:        body.retired        ?? false,
    tokyoAirRegi:   body.tokyoAirRegi   ?? "",
    tokyoAirShift:  body.tokyoAirShift  ?? "",
    osakaAirRegi:   body.osakaAirRegi   ?? "",
    osakaAirShift:  body.osakaAirShift  ?? "",
    nagoyaAirRegi:  body.nagoyaAirRegi  ?? "",
    nagoyaAirShift: body.nagoyaAirShift ?? "",
    commuteDaily:   Math.max(0, Math.round(Number(body.commuteDaily ?? 0))) || 0,
  };

  const master = await prisma.$transaction(async tx => {
    const existing = await tx.cast.findMany({ select: { castCode: true } });
    const allocate = createCastCodeAllocator(existing.map(m => m.castCode));
    return tx.cast.create({ data: { ...data, castCode: allocate() } });
  });

  return NextResponse.json({ master }, { status: 201 });
}
