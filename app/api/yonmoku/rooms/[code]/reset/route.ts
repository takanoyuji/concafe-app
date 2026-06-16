import { NextRequest, NextResponse } from "next/server";
import { resetRoom } from "@/lib/yonmoku-store";

/**
 * POST /api/yonmoku/rooms/[code]/reset
 * Body: { playerId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const playerId: unknown = body?.playerId;

  if (!playerId || typeof playerId !== "string") {
    return NextResponse.json({ error: "playerId が必要です" }, { status: 400 });
  }

  const result = resetRoom(code, playerId);
  if ("error" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  const room = result.room;
  return NextResponse.json({
    board: room.board,
    current: room.current,
    winner: room.winner,
    winLine: room.winLine,
    isDraw: room.isDraw,
    playerCount: (room.redId ? 1 : 0) + (room.yellowId ? 1 : 0),
  });
}
