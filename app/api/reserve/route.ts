import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ReservationSchema } from "@/lib/validations";
import {
  SETTINGS,
  checkVisitWindow,
  normalizePhone,
  isValidPhone,
  normalizePurchaseId,
  timeOptions,
} from "@/lib/reservation";

/**
 * お客様からの席予約の申し込み。**ログイン不要**の公開API。
 *
 * ここで作るのは PENDING（未対応）だけ。確定は管理画面から店舗が行う。
 * status / source をリクエストから受け取らないのは、公開APIから
 * 「確定済み」の予約を作られないようにするため。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が正しくありません" }, { status: 400 });
  }

  const parsed = ReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // 人数の上限は SETTINGS を唯一の出どころにする（zod 側に数字を二重に書かない）
  if (input.partySize > SETTINGS.maxPartySize)
    return NextResponse.json(
      { error: `${SETTINGS.maxPartySize}名を超えるご予約はお電話でお願いします` },
      { status: 400 }
    );

  if (!timeOptions().includes(input.visitTime))
    return NextResponse.json({ error: "来店時間を選び直してください" }, { status: 400 });

  const window = checkVisitWindow(input.visitDate, input.visitTime);
  if (!window.ok) return NextResponse.json({ error: window.error }, { status: 400 });

  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone))
    return NextResponse.json(
      { error: "電話番号は0から始まる10〜11桁でご入力ください" },
      { status: 400 }
    );

  const store = await prisma.store.findUnique({ where: { id: input.storeId } });
  if (!store) return NextResponse.json({ error: "店舗を選び直してください" }, { status: 400 });

  // いたずら・二重送信の抑止。IPそのものは保存せず、ハッシュだけ持つ
  const ipHash = hashIp(req);
  const since = new Date(Date.now() - SETTINGS.rateLimit.windowMinutes * 60 * 1000);
  const [byPhone, byIp] = await Promise.all([
    prisma.reservation.count({ where: { phone, createdAt: { gte: since } } }),
    ipHash
      ? prisma.reservation.count({ where: { ipHash, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);
  if (byPhone >= SETTINGS.rateLimit.maxPerPhone || byIp >= SETTINGS.rateLimit.maxPerIp)
    return NextResponse.json(
      { error: "お申し込みが続いています。しばらく時間をおいてからお試しください" },
      { status: 429 }
    );

  const reservation = await prisma.reservation.create({
    data: {
      storeId: store.id,
      visitDate: input.visitDate,
      visitTime: input.visitTime,
      partySize: input.partySize,
      customerName: input.customerName.trim(),
      phone,
      // 照合はしない。表記ゆれだけ吸収して自己申告のまま残す
      purchaseId: normalizePurchaseId(input.purchaseId ?? ""),
      // note はお客様向けフォームでは受け付けない（列は管理画面の手入力メモが使う）
      status: "PENDING",
      source: "LINE",
      ipHash,
      events: { create: { fromStatus: "", toStatus: "PENDING", memo: "お客様からの申し込み" } },
    },
  });

  // お客様には予約IDだけ返す。他人の予約を引ける経路を作らないため、内容は返さない
  return NextResponse.json({ id: reservation.id, status: "PENDING" }, { status: 201 });
}

/** x-forwarded-for の先頭（nginx が付ける）をハッシュ化する。塩が無ければ判定を諦める */
function hashIp(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!ip) return "";
  const salt = process.env.RESERVATION_IP_SALT ?? process.env.JWT_SECRET ?? "";
  if (!salt) return "";
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}
