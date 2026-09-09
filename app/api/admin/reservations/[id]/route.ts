import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ReservationStatusSchema } from "@/lib/validations";
import { canTransition, STATUS_LABEL, type ReservationStatus } from "@/lib/reservation";

/** 1件の詳細と、状態変更の履歴 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      store: { select: { name: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ reservation });
}

/**
 * 状態を変える（承認 / 却下 / キャンセル / 来店済み / 無断キャンセル）。
 *
 * 許可された遷移だけを通す。確定済みを未対応に戻す、来店済みをキャンセルにする、
 * といった後から台帳の意味が変わる操作は弾く。誰がいつ変えたかは必ず履歴に残す。
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const parsed = ReservationStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "状態の指定が正しくありません" }, { status: 400 });

  const current = await prisma.reservation.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = parsed.data.status;
  if (current.status === to)
    return NextResponse.json({ error: "すでにその状態です" }, { status: 409 });

  if (!canTransition(current.status, to)) {
    const from = STATUS_LABEL[current.status as ReservationStatus] ?? current.status;
    return NextResponse.json(
      { error: `「${from}」から「${STATUS_LABEL[to]}」には変更できません` },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  });

  const updated = await prisma.$transaction(async tx => {
    const r = await tx.reservation.update({
      where: { id },
      data: { status: to, lastActorId: session.userId },
    });
    await tx.reservationEvent.create({
      data: {
        reservationId: id,
        fromStatus: current.status,
        toStatus: to,
        actorId: session.userId,
        actorEmail: user?.email ?? "",
        memo: parsed.data.memo ?? "",
      },
    });
    return r;
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
