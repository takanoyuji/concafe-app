import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCastCodeAllocator } from "@/lib/castCode";

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

  // 受け付ける項目を明示する。castCode はここでは受け取らず、必ずサーバー側で採番する
  const data = {
    hpName:         body.hpName         ?? "",
    rank:           body.rank           ?? "",
    retired:        body.retired        ?? false,
    tokyoAirRegi:   body.tokyoAirRegi   ?? "",
    tokyoAirShift:  body.tokyoAirShift  ?? "",
    osakaAirRegi:   body.osakaAirRegi   ?? "",
    osakaAirShift:  body.osakaAirShift  ?? "",
    nagoyaAirRegi:  body.nagoyaAirRegi  ?? "",
    nagoyaAirShift: body.nagoyaAirShift ?? "",
  };

  const master = await prisma.$transaction(async tx => {
    const existing = await tx.castMaster.findMany({ select: { castCode: true } });
    const allocate = createCastCodeAllocator(existing.map(m => m.castCode));
    return tx.castMaster.create({ data: { ...data, castCode: allocate() } });
  });

  return NextResponse.json({ master }, { status: 201 });
}
