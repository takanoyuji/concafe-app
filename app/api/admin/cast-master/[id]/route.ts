import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // 更新を許可する項目だけを明示的に拾う。
  // castCode は外部システム（remodri 等）がキャストを参照する不変キーなので、
  // ここから書き換えられないようにする。undefined の項目は変更されない。
  const data = {
    hpName:         body.hpName,
    rank:           body.rank,
    retired:        body.retired,
    tokyoAirRegi:   body.tokyoAirRegi,
    tokyoAirShift:  body.tokyoAirShift,
    osakaAirRegi:   body.osakaAirRegi,
    osakaAirShift:  body.osakaAirShift,
    nagoyaAirRegi:  body.nagoyaAirRegi,
    nagoyaAirShift: body.nagoyaAirShift,
  };

  const master = await prisma.castMaster.update({ where: { id }, data });
  return NextResponse.json({ master });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.castMaster.delete({ where: { id } });
  return NextResponse.json({ message: "Deleted" });
}
