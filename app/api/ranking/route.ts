import { NextResponse } from "next/server";
import { getCastRanking } from "@/lib/points";

export async function GET() {
  const ranking = await getCastRanking();
  return NextResponse.json({ ranking });
}
