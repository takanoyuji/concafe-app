import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";

// 認証はテストごとに差し替える
const session = vi.hoisted(() => ({ current: null as null | { userId: string; role: string } }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => session.current,
}));

import { prisma } from "@/lib/prisma";
import { getCastRanking, getMonthlyRanking } from "@/lib/points";
import { GET as castListGET } from "@/app/api/cast/route";
import { GET as castDetailGET } from "@/app/api/cast/[id]/route";
import { GET as storeGET } from "@/app/api/store/[slug]/route";
import { POST as giftPOST } from "@/app/api/points/gift/route";
import { POST as profilePOST } from "@/app/api/me/profile/route";

const STORE_ID = "test-store";
const SHOWN = "cast-shown";
const HIDDEN = "cast-hidden";
const USER_ID = "test-user";

beforeAll(async () => {
  await prisma.store.create({
    data: { id: STORE_ID, slug: "tokyo", name: "テスト店", address: "-", mapQuery: "-" },
  });
  await prisma.cast.createMany({
    data: [
      { id: SHOWN, name: "公開キャスト", bio: "b", imageUrl: "/i.png", storeId: STORE_ID, isPublished: true, rank: "ゴールド", airShiftName: "秘密" },
      { id: HIDDEN, name: "非公開キャスト", bio: "b", imageUrl: "/i.png", storeId: STORE_ID, isPublished: false, rank: "ゴールド", airShiftName: "秘密" },
    ],
  });
  await prisma.user.create({
    data: { id: USER_ID, email: "t@example.com", passwordHash: "x", role: "CUSTOMER" },
  });
  // 非公開キャストにギフト実績を作る（フィルタが無ければランキング1位になる額）
  await prisma.pointLedger.createMany({
    data: [
      { type: "GRANT", amount: 10000, toUserId: USER_ID, idempotencyKey: "grant-1" },
      { type: "GIFT", amount: 9999, fromUserId: USER_ID, castId: HIDDEN, idempotencyKey: "gift-hidden" },
      { type: "GIFT", amount: 1, fromUserId: USER_ID, castId: SHOWN, idempotencyKey: "gift-shown" },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function req(url: string, body?: unknown) {
  return new NextRequest(url, body === undefined
    ? undefined
    : { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("非公開キャストは公開経路すべてから除外される", () => {
  it("ランキング（累計・月間）に出ない", async () => {
    session.current = null;
    const cumulative = await getCastRanking();
    const monthly = await getMonthlyRanking();
    expect(cumulative.map((c) => c.id)).toEqual([SHOWN]);
    expect(monthly.map((c) => c.id)).toEqual([SHOWN]);
  });

  it("店舗を絞ったランキングにも出ない", async () => {
    session.current = null;
    const ranking = await getCastRanking(STORE_ID);
    expect(ranking.map((c) => c.id)).toEqual([SHOWN]);
  });

  it("GET /api/cast に出ない（未ログイン）", async () => {
    session.current = null;
    const res = await castListGET(req("http://localhost/api/cast"));
    const { casts } = await res.json();
    expect(casts.map((c: { id: string }) => c.id)).toEqual([SHOWN]);
  });

  it("GET /api/cast?includeHidden=1 は一般ユーザーには効かない", async () => {
    session.current = { userId: USER_ID, role: "CUSTOMER" };
    const res = await castListGET(req("http://localhost/api/cast?includeHidden=1"));
    const { casts } = await res.json();
    expect(casts.map((c: { id: string }) => c.id)).toEqual([SHOWN]);
  });

  it("GET /api/cast?includeHidden=1 は管理者にのみ非公開キャストを返す", async () => {
    session.current = { userId: USER_ID, role: "ADMIN" };
    const res = await castListGET(req("http://localhost/api/cast?includeHidden=1"));
    const { casts } = await res.json();
    expect(casts.map((c: { id: string }) => c.id).sort()).toEqual([HIDDEN, SHOWN].sort());
  });

  it("GET /api/cast/[id] は非公開キャストを404にする", async () => {
    session.current = null;
    const res = await castDetailGET(req(`http://localhost/api/cast/${HIDDEN}`), {
      params: Promise.resolve({ id: HIDDEN }),
    });
    expect(res.status).toBe(404);
  });

  it("GET /api/store/[slug] に出ない", async () => {
    session.current = null;
    const res = await storeGET(req("http://localhost/api/store/tokyo"), {
      params: Promise.resolve({ slug: "tokyo" }),
    });
    const { store } = await res.json();
    expect(store.casts.map((c: { id: string }) => c.id)).toEqual([SHOWN]);
  });

  it("ギフトを送れない（サーバー側で拒否）", async () => {
    session.current = { userId: USER_ID, role: "CUSTOMER" };
    const res = await giftPOST(
      req("http://localhost/api/points/gift", { castId: HIDDEN, amount: 100, idempotencyKey: "try-hidden" })
    );
    expect(res.status).toBe(404);
    // 台帳に記録されていないこと
    expect(await prisma.pointLedger.findUnique({ where: { idempotencyKey: "try-hidden" } })).toBeNull();
  });

  it("推しキャストに設定できない（サーバー側で拒否）", async () => {
    session.current = { userId: USER_ID, role: "CUSTOMER" };
    const res = await profilePOST(
      req("http://localhost/api/me/profile", { name: "テスト", favoriteCast1Id: HIDDEN })
    );
    expect(res.status).toBe(400);
    const user = await prisma.user.findUnique({ where: { id: USER_ID } });
    expect(user?.favoriteCast1Id).toBeNull();
  });
});

describe("公開キャストは従来どおり表示される", () => {
  it("GET /api/cast で取得でき、給与情報は含まれない", async () => {
    session.current = null;
    const res = await castListGET(req("http://localhost/api/cast"));
    const { casts } = await res.json();
    expect(casts).toHaveLength(1);
    expect(casts[0]).not.toHaveProperty("rank");
    expect(casts[0]).not.toHaveProperty("airShiftName");
    expect(casts[0]).not.toHaveProperty("exemptFromCommuteRule");
  });

  it("GET /api/store/[slug] も給与情報を返さない", async () => {
    session.current = null;
    const res = await storeGET(req("http://localhost/api/store/tokyo"), {
      params: Promise.resolve({ slug: "tokyo" }),
    });
    const { store } = await res.json();
    expect(store.casts[0]).not.toHaveProperty("rank");
    expect(store.casts[0]).not.toHaveProperty("airShiftName");
  });

  it("推しキャストに設定できる", async () => {
    session.current = { userId: USER_ID, role: "CUSTOMER" };
    const res = await profilePOST(
      req("http://localhost/api/me/profile", { name: "テスト", favoriteCast1Id: SHOWN })
    );
    expect(res.status).toBe(200);
    const user = await prisma.user.findUnique({ where: { id: USER_ID } });
    expect(user?.favoriteCast1Id).toBe(SHOWN);
  });
});
