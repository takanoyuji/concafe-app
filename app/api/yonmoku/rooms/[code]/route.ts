import { NextRequest, NextResponse } from "next/server";
import { getRoom, joinRoom, type RoomState } from "@/lib/yonmoku-store";

/** ルーム状態をクライアントに返す形式にシリアライズ（内部IDは公開しない） */
function serialize(room: RoomState, myRole: string | null) {
  return {
    code: room.code,
    board: room.board,
    current: room.current,
    winner: room.winner,
    winLine: room.winLine,
    isDraw: room.isDraw,
    playerCount: (room.redId ? 1 : 0) + (room.yellowId ? 1 : 0),
    myRole,
  };
}

/**
 * GET /api/yonmoku/rooms/[code]?playerId=xxx
 * ルーム状態を取得する。playerId が指定された場合は自動的に参加処理も行う。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const playerId = req.nextUrl.searchParams.get("playerId");

  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });
  }

  let myRole: string | null = null;
  if (playerId) {
    myRole = joinRoom(code, playerId);
  }

  return NextResponse.json(serialize(room, myRole));
}
