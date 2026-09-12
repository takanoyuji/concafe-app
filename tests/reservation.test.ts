import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as null | { userId: string; role: string } }));
vi.mock("@/lib/auth", () => ({ getSession: async () => session.current }));

// メールは送らず、呼ばれた記録だけ取る。fail=true にすると送信失敗を再現する
const mail = vi.hoisted(() => ({
  sent: [] as Array<{ kind: string; to: string; customerName: string }>,
  fail: false,
}));
vi.mock("@/lib/email", () => {
  const record = (kind: string) => async (r: { to: string; customerName: string }) => {
    if (mail.fail) throw new Error("mail down");
    mail.sent.push({ kind, to: r.to, customerName: r.customerName });
  };
  return {
    sendReservationReceivedEmail: record("received"),
    sendReservationConfirmedEmail: record("confirmed"),
    sendReservationDeclinedEmail: record("declined"),
  };
});

import { prisma } from "@/lib/prisma";
import { POST as reservePOST } from "@/app/api/reserve/route";
import {
  GET as adminGET,
  POST as adminPOST,
} from "@/app/api/admin/reservations/route";
import { PATCH as adminPATCH } from "@/app/api/admin/reservations/[id]/route";
import {
  addDays, jstNow, normalizePhone, checkVisitWindow, isOverdue,
  replyableMinutes, timeOptions, SETTINGS,
  looksLikeBasePurchaseId, normalizePurchaseId,
  customerReservationWhere, normalizeEmail, CUSTOMER_STATUS_LABEL,
} from "@/lib/reservation";

const TOMORROW = addDays(jstNow().date, 1);

function reserveReq(body: Record<string, unknown>, ip = "203.0.113.1") {
  return new Request("http://localhost/api/reserve", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const VALID = {
  visitDate: TOMORROW,
  visitTime: "19:00",
  partySize: 2,
  customerName: "星野 狼",
  phone: "090-1234-5678",
};

const STORE_SLUG = "reservation-test";
const ADMIN_EMAIL = "reservation-admin@example.com";
// 予約はログイン必須なので、申し込みには会員が要る
const MEMBER_EMAIL = "Hoshino@Example.com"; // 大文字混じり。保存時に小文字へ揃うことを見る
const MEMBER2_EMAIL = "member2@example.com";
let storeId = "";
let adminId = "";
let memberId = "";
let member2Id = "";

/** 会員としてログインした状態にする */
function loginAs(userId: string) {
  session.current = { userId, role: "CUSTOMER" };
}

beforeEach(async () => {
  await prisma.reservationEvent.deleteMany();
  await prisma.reservation.deleteMany();

  // 他のテストと同じ slug を使わない。テストDBは1本を全ファイルで共有しているため、
  // "tokyo" を作ると cast-visibility 側の store.create がユニーク制約で落ちる
  const store = await prisma.store.upsert({
    where: { slug: STORE_SLUG },
    update: {},
    create: { slug: STORE_SLUG, name: "池袋店", address: "東京", mapQuery: "池袋" },
  });
  storeId = store.id;

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: { email: ADMIN_EMAIL, passwordHash: "x", role: "ADMIN" },
  });
  adminId = admin.id;

  const [m1, m2] = await Promise.all(
    [MEMBER_EMAIL, MEMBER2_EMAIL].map(email =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, passwordHash: "x", role: "CUSTOMER", emailVerified: true },
      })
    )
  );
  memberId = m1.id;
  member2Id = m2.id;

  // 既定はログイン済みの会員。未ログインを試すテストは session.current = null にする
  loginAs(memberId);
  mail.sent = [];
  mail.fail = false;
});

// 後続のテストファイルに自分の作ったデータを残さない
afterAll(async () => {
  await prisma.reservationEvent.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  await prisma.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, MEMBER_EMAIL, MEMBER2_EMAIL] } } });
});

describe("予約の申し込み（公開API）", () => {
  it("受け付けた予約は必ず未対応で入る。自動確定しない", async () => {
    const res = await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(res.status).toBe(201);

    const rows = await prisma.reservation.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING");
    // 電話番号は数字のみに正規化して入る
    expect(rows[0].phone).toBe("09012345678");
    // 申し込みも履歴に1件残る
    const events = await prisma.reservationEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0].toStatus).toBe("PENDING");
  });

  it("購入IDは大文字・空白なしに揃えて保存する", async () => {
    await reservePOST(reserveReq({ ...VALID, storeId, purchaseId: " 1ae7f1f358d8940c " }));
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.purchaseId).toBe("1AE7F1F358D8940C");
  });

  it("購入IDが未入力でも申し込める（購入は予約の条件ではない）", async () => {
    const res = await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(res.status).toBe(201);
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.purchaseId).toBe("");
  });

  it("購入IDの形が違っても弾かない。保存して台帳で警告する", async () => {
    const res = await reservePOST(reserveReq({ ...VALID, storeId, purchaseId: "たぶんこれ123" }));
    expect(res.status).toBe(201);
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.purchaseId).toBe("たぶんこれ123");
    expect(looksLikeBasePurchaseId(row.purchaseId)).toBe(false);
  });

  it("公開APIから確定済みの予約は作れない（status/source を受け取らない）", async () => {
    await reservePOST(reserveReq({ ...VALID, storeId, status: "CONFIRMED", source: "PHONE" }));
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.status).toBe("PENDING");
    expect(row.source).toBe("LINE");
  });

  it("未ログインでは申し込めない（予約は会員登録・ログイン必須）", async () => {
    session.current = null;
    const res = await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(res.status).toBe(401);
    expect(await prisma.reservation.count()).toBe(0);
  });

  it("会員IDと会員のメールアドレス（小文字に揃えたもの）が予約に付く。フォームのメールは無視する", async () => {
    await reservePOST(reserveReq({ ...VALID, storeId, email: "attacker@example.com" }));
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.userId).toBe(memberId);
    expect(row.email).toBe("hoshino@example.com");
  });

  it("受け付けたら受付メールを送る", async () => {
    await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(mail.sent).toEqual([{ kind: "received", to: "hoshino@example.com", customerName: "星野 狼" }]);
  });

  it("受付メールが送れなくても申し込みは成立する", async () => {
    mail.fail = true;
    const res = await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(res.status).toBe(201);
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("上限人数を超える申し込みは弾く", async () => {
    const res = await reservePOST(
      reserveReq({ ...VALID, storeId, partySize: SETTINGS.maxPartySize + 1 })
    );
    expect(res.status).toBe(400);
    expect(await prisma.reservation.count()).toBe(0);
  });

  it("受付範囲より先の日付は弾く", async () => {
    const far = addDays(jstNow().date, SETTINGS.maxDaysAhead + 1);
    const res = await reservePOST(reserveReq({ ...VALID, storeId, visitDate: far }));
    expect(res.status).toBe(400);
  });

  it("電話番号の桁が足りなければ弾く", async () => {
    const res = await reservePOST(reserveReq({ ...VALID, storeId, phone: "12345" }));
    expect(res.status).toBe(400);
  });

  it("同じ電話番号の連続申し込みは上限で止まる", async () => {
    for (let i = 0; i < SETTINGS.rateLimit.maxPerPhone; i++) {
      const ok = await reservePOST(reserveReq({ ...VALID, storeId }));
      expect(ok.status).toBe(201);
    }
    const blocked = await reservePOST(reserveReq({ ...VALID, storeId }));
    expect(blocked.status).toBe(429);
  });
});

describe("予約台帳（管理API）", () => {
  async function createPending() {
    await reservePOST(reserveReq({ ...VALID, storeId }));
    return prisma.reservation.findFirstOrThrow();
  }

  it("管理者以外は台帳を見られない", async () => {
    session.current = null;
    expect((await adminGET(new Request("http://localhost/api/admin/reservations"))).status).toBe(403);

    session.current = { userId: "someone", role: "CUSTOMER" };
    expect((await adminGET(new Request("http://localhost/api/admin/reservations"))).status).toBe(403);
  });

  it("台帳は購入IDと「形が正しそうか」を返す。照合結果ではない", async () => {
    await reservePOST(reserveReq({ ...VALID, storeId, purchaseId: "1AE7F1F358D8940C" }));
    await reservePOST(reserveReq({ ...VALID, storeId, phone: "090-2222-3333", purchaseId: "あやしい" }));
    session.current = { userId: adminId, role: "ADMIN" };

    const res = await adminGET(new Request("http://localhost/api/admin/reservations"));
    const body = await res.json();
    const ok = body.reservations.find((x: { purchaseId: string }) => x.purchaseId === "1AE7F1F358D8940C");
    const ng = body.reservations.find((x: { purchaseId: string }) => x.purchaseId === "あやしい");
    expect(ok.purchaseIdLooksValid).toBe(true);
    // 形が違っても台帳には出す。店舗が見て判断できるようにするため
    expect(ng.purchaseIdLooksValid).toBe(false);
  });

  it("承認すると確定になり、誰が変えたかが履歴に残る", async () => {
    const r = await createPending();
    session.current = { userId: adminId, role: "ADMIN" };

    const res = await adminPATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) }),
      { params: Promise.resolve({ id: r.id }) }
    );
    expect(res.status).toBe(200);

    const after = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(after.status).toBe("CONFIRMED");
    expect(after.lastActorId).toBe(adminId);

    const events = await prisma.reservationEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(events.at(-1)).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "CONFIRMED",
      actorEmail: ADMIN_EMAIL,
    });
  });

  it("確定・お断りにするとお客様へメールが届く。来店済み等では送らない", async () => {
    const patch = (id: string, status: string) =>
      adminPATCH(
        new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status }) }),
        { params: Promise.resolve({ id }) }
      );
    const a = await createPending();
    await reservePOST(reserveReq({ ...VALID, storeId, phone: "090-2222-3333" }));
    const b = await prisma.reservation.findFirstOrThrow({ where: { phone: "09022223333" } });
    mail.sent = [];
    session.current = { userId: adminId, role: "ADMIN" };

    expect((await patch(a.id, "CONFIRMED")).status).toBe(200);
    expect((await patch(a.id, "VISITED")).status).toBe(200);
    expect((await patch(b.id, "DECLINED")).status).toBe(200);

    expect(mail.sent.map(m => m.kind)).toEqual(["confirmed", "declined"]);
    expect(mail.sent.every(m => m.to === "hoshino@example.com")).toBe(true);
  });

  it("結果メールが送れなくても状態変更は通る", async () => {
    const r = await createPending();
    session.current = { userId: adminId, role: "ADMIN" };
    mail.fail = true;
    const res = await adminPATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "CONFIRMED" }) }),
      { params: Promise.resolve({ id: r.id }) }
    );
    expect(res.status).toBe(200);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("CONFIRMED");
  });

  it("手入力はメールアドレス無しでも入り、自動メールは送らない", async () => {
    session.current = { userId: adminId, role: "ADMIN" };
    const res = await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ ...VALID, storeId, source: "PHONE", status: "CONFIRMED" }),
      })
    );
    expect(res.status).toBe(201);
    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.email).toBe("");
    expect(mail.sent).toEqual([]);
  });

  it("来店済みをキャンセルに戻すような遷移は弾く", async () => {
    const r = await createPending();
    session.current = { userId: adminId, role: "ADMIN" };
    const patch = (status: string) =>
      adminPATCH(
        new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status }) }),
        { params: Promise.resolve({ id: r.id }) }
      );

    await patch("CONFIRMED");
    await patch("VISITED");
    const res = await patch("CANCELED");
    expect(res.status).toBe(409);

    const after = await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(after.status).toBe("VISITED");
  });

  it("予約は削除されず、状態だけが変わる", async () => {
    const r = await createPending();
    session.current = { userId: adminId, role: "ADMIN" };
    await adminPATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "DECLINED" }) }),
      { params: Promise.resolve({ id: r.id }) }
    );
    expect(await prisma.reservation.count()).toBe(1);
  });

  it("電話で受けた予約を手入力できる。受付経路が残る", async () => {
    session.current = { userId: adminId, role: "ADMIN" };
    const res = await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ ...VALID, storeId, source: "PHONE", status: "CONFIRMED" }),
      })
    );
    expect(res.status).toBe(201);

    const row = await prisma.reservation.findFirstOrThrow();
    expect(row.source).toBe("PHONE");
    expect(row.status).toBe("CONFIRMED");
  });

  it("手入力は過去日も入れられる（当日の電話予約を後から台帳に足すため）", async () => {
    session.current = { userId: adminId, role: "ADMIN" };
    const yesterday = addDays(jstNow().date, -1);
    const res = await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ ...VALID, storeId, visitDate: yesterday, source: "PHONE" }),
      })
    );
    expect(res.status).toBe(201);
  });

  it("一覧は来店日時の順に返る", async () => {
    session.current = { userId: adminId, role: "ADMIN" };
    const mk = (visitDate: string, visitTime: string) =>
      adminPOST(
        new Request("http://localhost/api/admin/reservations", {
          method: "POST",
          body: JSON.stringify({ ...VALID, storeId, visitDate, visitTime, source: "PHONE" }),
        })
      );
    await mk(addDays(jstNow().date, 3), "21:00");
    await mk(addDays(jstNow().date, 3), "18:00");
    await mk(addDays(jstNow().date, 1), "22:00");

    const res = await adminGET(new Request("http://localhost/api/admin/reservations"));
    const { reservations } = await res.json();
    expect(reservations.map((r: { visitTime: string }) => r.visitTime)).toEqual([
      "22:00", "18:00", "21:00",
    ]);
  });
});

describe("会員のマイページに出す予約（要件書 10章）", () => {
  const ME = "hoshino@example.com";

  async function seed() {
    // 1. 自分がログインして申し込んだ
    loginAs(memberId);
    await reservePOST(reserveReq({ ...VALID, storeId }));
    // 2. 別の会員が申し込んだ
    loginAs(member2Id);
    await reservePOST(reserveReq({ ...VALID, storeId, phone: "090-6666-7777" }));
    // 3. 店舗が電話で受けて手入力した分（メールアドレス付き）。userId は付かない
    session.current = { userId: adminId, role: "ADMIN" };
    await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ ...VALID, storeId, phone: "090-2222-3333", email: ME, source: "PHONE" }),
      })
    );
    // 4. 手入力・メールアドレス無し
    await adminPOST(
      new Request("http://localhost/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ ...VALID, storeId, phone: "090-4444-5555", source: "PHONE" }),
      })
    );
    session.current = null;
  }

  it("メール認証済みの会員は、自分で申し込んだ分と、同じメールアドレスで手入力された分が見える", async () => {
    await seed();
    const rows = await prisma.reservation.findMany({
      where: customerReservationWhere({ id: memberId, email: MEMBER_EMAIL, emailVerified: true }),
    });
    expect(rows.map(r => r.phone).sort()).toEqual(["09012345678", "09022223333"]);
  });

  it("未認証の会員には、自分で申し込んだ分しか見せない（他人のメールで登録して覗く経路を塞ぐ）", async () => {
    await seed();
    const rows = await prisma.reservation.findMany({
      where: customerReservationWhere({ id: memberId, email: MEMBER_EMAIL, emailVerified: false }),
    });
    expect(rows.map(r => r.phone)).toEqual(["09012345678"]);
  });

  it("他の会員の予約は見えない", async () => {
    await seed();
    const rows = await prisma.reservation.findMany({
      where: customerReservationWhere({ id: member2Id, email: MEMBER2_EMAIL, emailVerified: true }),
    });
    expect(rows.map(r => r.phone)).toEqual(["09066667777"]);
    expect(normalizeEmail("  A@B.JP ")).toBe("a@b.jp");
  });

  it("お客様向けの状態は4つの言葉に丸める。来店済み・無断キャンセルは「予約確定」のまま", () => {
    expect(new Set(Object.values(CUSTOMER_STATUS_LABEL)).size).toBe(4);
    expect(CUSTOMER_STATUS_LABEL.VISITED).toBe("予約確定");
    expect(CUSTOMER_STATUS_LABEL.NO_SHOW).toBe("予約確定");
    expect(CUSTOMER_STATUS_LABEL.PENDING).toBe("申請中");
  });
});

describe("入力の正規化と受付範囲", () => {
  it("BASEの注文IDらしいかは16進16桁で判定する。照合ではない", () => {
    expect(looksLikeBasePurchaseId("1AE7F1F358D8940C")).toBe(true);
    expect(looksLikeBasePurchaseId(" 1ae7f1f358d8940c ")).toBe(true);
    expect(looksLikeBasePurchaseId("1AE7F1F358D8940")).toBe(false);   // 15桁
    expect(looksLikeBasePurchaseId("1AE7F1F358D8940CZ")).toBe(false); // 16進でない
    expect(looksLikeBasePurchaseId("")).toBe(false);
  });

  it("購入IDの正規化は前後の空白を落として大文字に寄せる", () => {
    expect(normalizePurchaseId("  1ae7f1f358d8940c ")).toBe("1AE7F1F358D8940C");
    expect(normalizePurchaseId("")).toBe("");
  });

  it("全角・ハイフン・+81 を数字だけに揃える", () => {
    expect(normalizePhone("０９０-１２３４-５６７８")).toBe("09012345678");
    expect(normalizePhone("+81 90 1234 5678")).toBe("09012345678");
    expect(normalizePhone("03(1234)5678")).toBe("0312345678");
  });

  it("当日の直前の申し込みは締切で弾き、公式LINEへ案内する", () => {
    // JST 2026-09-08 19:00 時点。締切は来店の30分前
    const now = new Date("2026-09-08T10:00:00Z");

    const tooLate = checkVisitWindow("2026-09-08", "19:20", now);
    expect(tooLate.ok).toBe(false);
    // 弾いて終わりにせず、行き先（公式LINE）を必ず書く
    if (!tooLate.ok) expect(tooLate.error).toContain("公式LINE");

    expect(checkVisitWindow("2026-09-08", "20:00", now).ok).toBe(true);
  });

  it("フォームの時刻は1時間刻みで、最終受付までしか出さない", () => {
    expect(timeOptions()).toEqual(["18:00", "19:00", "20:00", "21:00", "22:00"]);
  });

  it("承認の目安は 0:00〜12:00 を数えない", () => {
    // JST 23:00 に届いた申し込み
    const created = new Date("2026-09-08T14:00:00Z");

    // 翌 JST 4:00（実時間で5時間経過）。返信できない時間帯なので、まだ警告は出ない
    expect(replyableMinutes(created, new Date("2026-09-08T19:00:00Z"))).toBe(60);
    expect(isOverdue("PENDING", created, new Date("2026-09-08T19:00:00Z"))).toBe(false);

    // 翌 JST 13:00。24:00までの1時間＋12:00からの1時間で計2時間。まだ3時間に届かない
    expect(isOverdue("PENDING", created, new Date("2026-09-09T04:00:00Z"))).toBe(false);

    // 翌 JST 15:00。1時間＋3時間で4時間。ここで初めて警告が出る
    expect(replyableMinutes(created, new Date("2026-09-09T06:00:00Z"))).toBe(240);
    expect(isOverdue("PENDING", created, new Date("2026-09-09T06:00:00Z"))).toBe(true);
  });

  it("未対応でなければ警告は出ない", () => {
    const created = new Date("2026-09-08T03:00:00Z"); // JST 12:00
    const later = new Date("2026-09-08T09:00:00Z");   // JST 18:00
    expect(isOverdue("CONFIRMED", created, later)).toBe(false);
    expect(isOverdue("PENDING", created, later)).toBe(true);
  });

  it("サーバーがUTCでもJSTの日付で判定する", () => {
    // UTC では 9/8 だが JST では 9/9。9/9 は「過去」ではない
    const now = new Date("2026-09-08T16:00:00Z");
    expect(jstNow(now).date).toBe("2026-09-09");
    expect(checkVisitWindow("2026-09-09", "22:00", now).ok).toBe(true);
  });
});
