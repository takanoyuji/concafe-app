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
  const { name, backRate, order, hourlyWage, commutePaid } = body;
  if (!name || backRate == null) {
    return NextResponse.json({ error: "name と backRate は必須です" }, { status: 400 });
  }

  const rank = await prisma.castRank.create({
    data: {
      name, backRate: Number(backRate), order: Number(order ?? 0),
      // 時給（円）と交通費○/×。みせ勤から人件費を作るときに使う
      hourlyWage: Math.max(0, Math.round(Number(hourlyWage ?? 0))),
      commutePaid: commutePaid == null ? true : Boolean(commutePaid),
    },
  });
  return NextResponse.json({ rank }, { status: 201 });
}
