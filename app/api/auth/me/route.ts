import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseFavoriteCastIds } from "@/lib/favorite-casts";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      mustChangePassword: true,
      createdAt: true,
      favoriteCastIds: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { favoriteCastIds: favRaw, ...rest } = user;
  return NextResponse.json({
    user: { ...rest, favoriteCastIds: parseFavoriteCastIds(favRaw) },
  });
}
