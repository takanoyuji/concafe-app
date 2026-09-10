import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { AdminReservationSchema } from "@/lib/validations";
import {
  SETTINGS,
  isOverdue,
  isStatus,
  normalizePhone,
  isValidPhone,
  normalizePurchaseId,
  looksLikeBasePurchaseId,
  jstNow,
  addDays,
} from "@/lib/reservation";

/**
 * 予約台帳。**管理者のみ**。氏名と電話番号を含むので、公開側のAPIとは経路を分ける。
 *
 * 既定では「今日以降」を返す。過去分は from を指定して取る。
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const from = url.searchParams.get("from") ?? jstNow().date;
  const to = url.searchParams.get("to") ?? addDays(jstNow().date, SETTINGS.maxDaysAhead + 30);

  const rows = await prisma.reservation.findMany({
    where: {
      visitDate: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
      ...(status && isStatus(status) ? { status } : {}),
    },
    include: { store: { select: { name: true } } },
    orderBy: [{ visitDate: "asc" }, { visitTime: "asc" }],
  });

  const now = new Date();
  return NextResponse.json({
    reservations: rows.map(r => ({
      id: r.id,
      storeId: r.storeId,
      storeName: r.store?.name ?? "",
      visitDate: r.visitDate,
      visitTime: r.visitTime,
      partySize: r.partySize,
      customerName: r.customerName,
      phone: r.phone,
      note: r.note,
      purchaseId: r.purchaseId,
      /// 形が BASE の注文IDらしいか。照合結果ではなく見た目の判定にすぎない
      purchaseIdLooksValid: looksLikeBasePurchaseId(r.purchaseId),
      status: r.status,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
      /// 承認の目安時間を過ぎた未対応。台帳で警告表示する
      overdue: isOverdue(r.status, r.createdAt, now),
    })),
    settings: SETTINGS,
  });
}

/**
 * 電話・DMで受けた予約の手入力。
 *
 * お客様向けの申し込みと違い、**過去日も入れられる**（当日受けた電話予約を、
 * 営業後にまとめて台帳へ入れる運用があるため）。受付経路を必ず記録する。
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = AdminReservationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" },
      { status: 400 }
    );
  const input = parsed.data;

  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone))
    return NextResponse.json({ error: "電話番号は0から始まる10〜11桁で入力してください" }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) return NextResponse.json({ error: "店舗が見つかりません" }, { status: 400 });

  const reservation = await prisma.reservation.create({
    data: {
      storeId: store.id,
      visitDate: input.visitDate,
      visitTime: input.visitTime,
      partySize: input.partySize,
      customerName: input.customerName.trim(),
      phone,
      note: input.note ?? "",
      purchaseId: normalizePurchaseId(input.purchaseId ?? ""),
      status: input.status,
      source: input.source,
      lastActorId: session.userId,
      events: {
        create: {
          fromStatus: "",
          toStatus: input.status,
          actorId: session.userId,
          memo: "管理画面から手入力",
        },
      },
    },
  });

  return NextResponse.json({ id: reservation.id }, { status: 201 });
}
