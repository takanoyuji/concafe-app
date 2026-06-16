import { NextRequest, NextResponse } from "next/server";
import { makeMove } from "@/lib/yonmoku-store";

/**
 * POST /api/yonmoku/rooms/[code]/move
 * Body: { playerId: string, col: number }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await req.json().catch(() => null);
  const { playerId, col } = body ?? {};

  if (!playerId || typeof col !== "number") {
    return NextResponse.json({ error: "playerId と col が必要です" }, { status: 400 });
  }

  const result = makeMove(code, playerId, col);
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
