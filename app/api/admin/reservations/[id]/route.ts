import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/authz";
import { ReservationStatusSchema } from "@/lib/validations";
import { sendReservationConfirmedEmail, sendReservationDeclinedEmail } from "@/lib/email";
import { canTransition, STATUS_LABEL, type ReservationStatus } from "@/lib/reservation";

/** 1件の詳細と、状態変更の履歴 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireFeature("reservations");
  if (session instanceof Response) return session;

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
  const session = await requireFeature("reservations");
  if (session instanceof Response) return session;

  const { id } = await ctx.params;
  const parsed = ReservationStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "状態の指定が正しくありません" }, { status: 400 });

  const current = await prisma.reservation.findUnique({
    where: { id },
    include: { store: { select: { name: true } } },
  });
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

  // お客様へのメッセージ。確定/お断りのときに最新のものを予約に持ち、履歴にも残す
  const message = parsed.data.message ?? "";
  const notifies = to === "CONFIRMED" || to === "DECLINED";
  const updated = await prisma.$transaction(async tx => {
    const r = await tx.reservation.update({
      where: { id },
      data: { status: to, lastActorId: session.userId, ...(notifies ? { staffMessage: message } : {}) },
    });
    await tx.reservationEvent.create({
      data: {
        reservationId: id,
        fromStatus: current.status,
        toStatus: to,
        actorId: session.userId,
        actorEmail: user?.email ?? "",
        memo: parsed.data.memo ?? "",
        message,
      },
    });
    return r;
  });

  // 確定 / お断りはお客様にメールで知らせる（要件書 10章）。
  // 送れなくても状態変更は通す。LINEでの連絡も続けるので、失敗はログに残すだけ
  if (current.email && (to === "CONFIRMED" || to === "DECLINED")) {
    const info = {
      to: current.email,
      storeName: current.store?.name ?? "",
      visitDate: current.visitDate,
      visitTime: current.visitTime,
      partySize: current.partySize,
      customerName: current.customerName,
      message,
    };
    try {
      if (to === "CONFIRMED") await sendReservationConfirmedEmail(info);
      else await sendReservationDeclinedEmail(info);
    } catch (e) {
      console.error("[RESERVATION] 結果メールの送信に失敗:", id, to, e);
    }
  }

  return NextResponse.json({ id: updated.id, status: updated.status });
}
