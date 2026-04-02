import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
  }
  if (name.trim().length > 30) {
    return NextResponse.json({ error: "名前は30文字以内で入力してください" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name: name.trim() },
    select: { name: true },
  });

  return NextResponse.json({ name: user.name });
}
