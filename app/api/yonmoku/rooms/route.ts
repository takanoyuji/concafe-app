import { NextRequest, NextResponse } from "next/server";
import { createRoom } from "@/lib/yonmoku-store";

/** POST /api/yonmoku/rooms — ルームを作成する */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const creatorId: unknown = body?.creatorId;

  if (!creatorId || typeof creatorId !== "string") {
    return NextResponse.json({ error: "creatorId が必要です" }, { status: 400 });
  }

  const room = createRoom(creatorId);
  return NextResponse.json({ code: room.code });
}
