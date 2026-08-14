import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// 認証はテストごとに差し替える
const session = vi.hoisted(() => ({ current: null as null | { userId: string; role: string } }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => session.current,
}));

import { prisma } from "@/lib/prisma";
import { POST as bulkPOST } from "@/app/api/admin/cast-master/bulk/route";
import { GET as syncGET } from "@/app/api/sync/cast-master/route";
import { createCastCodeAllocator, formatCastCode, parseCastCode } from "@/lib/castCode";

function bulkReq(body: unknown) {
  return new Request("http://localhost/api/admin/cast-master/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function syncReq(token?: string, query = "") {
  return new Request(`http://localhost/api/sync/cast-master${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(async () => {
  session.current = { userId: "admin", role: "ADMIN" };
  await prisma.castMonthlyRank.deleteMany();
  await prisma.castStore.deleteMany();
  await prisma.cast.deleteMany();
  await prisma.store.deleteMany();
  await prisma.store.create({
    data: { slug: "tokyo", name: "テスト店", address: "-", mapQuery: "-" },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CSV一括取込（upsert）", () => {
  it("取込後も月次ランクの履歴が残り、レコードが作り直されない", async () => {
    const m = await prisma.cast.create({
      data: { castCode: "C0001", name: "さくら", rank: "S" },
    });
    await prisma.castMonthlyRank.createMany({
      data: [
        { castId: m.id, year: 2026, month: 6, rank: "A" },
        { castId: m.id, year: 2026, month: 7, rank: "S" },
      ],
    });

    const res = await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", name: "さくら", rank: "S" }] }));
    expect(res.status).toBe(200);

    // 以前は deleteMany で cascade 削除されていた
    expect(await prisma.castMonthlyRank.count()).toBe(2);

    const after = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.id).toBe(m.id);
  });

  it("CSVに退職列が無いとき、退職フラグが維持される", async () => {
    await prisma.cast.create({
      data: { castCode: "C0001", name: "みお", rank: "B", retired: true },
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", name: "みお", rank: "B" }] }));

    // 以前は毎回 false に戻り、退職者が給与集計に復活していた
    const after = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.retired).toBe(true);
  });

  it("CSVに退職列があればその値で更新される", async () => {
    await prisma.cast.create({
      data: { castCode: "C0001", name: "みお", rank: "B", retired: true },
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", name: "みお", retired: false }] }));

    const after = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.retired).toBe(false);
  });

  it("既定ではCSVに載っていない既存キャストを退職扱いにしない", async () => {
    await prisma.cast.createMany({
      data: [
        { castCode: "C0001", name: "さくら" },
        { castCode: "C0002", name: "ゆい" },
      ],
    });

    const res = await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", name: "さくら" }] }));
    const body = await res.json();

    // 統合により Cast が唯一のマスタになったので、給与用CSVに載っていないだけの
    // キャスト（HP専用で登録された人など）を巻き込まないようにしている
    expect(body.retiredCasts).toEqual([]);
    const yui = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0002" } });
    expect(yui.retired).toBe(false);
  });

  it("retireMissing:true を明示したときはCSVに載っていない既存キャストを退職扱いにする", async () => {
    await prisma.cast.createMany({
      data: [
        { castCode: "C0001", name: "さくら" },
        { castCode: "C0002", name: "ゆい" },
      ],
    });

    const res = await bulkPOST(
      bulkReq({ masters: [{ castCode: "C0001", name: "さくら" }], retireMissing: true })
    );
    const body = await res.json();

    expect(body.retiredCasts).toEqual([{ castCode: "C0002", name: "ゆい" }]);
    const yui = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0002" } });
    expect(yui.retired).toBe(true);
    // レコードは消さないので、管理画面でチェックを外せば戻せる
    expect(await prisma.cast.count()).toBe(2);
  });

  it("retireMissing:false でも CSV未掲載を退職扱いにしない", async () => {
    await prisma.cast.createMany({
      data: [
        { castCode: "C0001", name: "さくら" },
        { castCode: "C0002", name: "ゆい" },
      ],
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", name: "さくら" }], retireMissing: false }));

    const yui = await prisma.cast.findUniqueOrThrow({ where: { castCode: "C0002" } });
    expect(yui.retired).toBe(false);
  });

  it("castCode 列が無い旧CSVは HP名で既存に突き合わせる（重複作成しない）", async () => {
    const m = await prisma.cast.create({ data: { castCode: "C0001", name: "さくら", rank: "A" } });

    const res = await bulkPOST(bulkReq({ masters: [{ name: "さくら", rank: "S" }] }));
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(await prisma.cast.count()).toBe(1);

    const after = await prisma.cast.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.rank).toBe("S");
    expect(after.castCode).toBe("C0001"); // コードは変わらない
  });

  it("新規行には既存の続きから castCode が採番される", async () => {
    await prisma.cast.create({ data: { castCode: "C0007", name: "さくら" } });

    await bulkPOST(bulkReq({
      masters: [
        { castCode: "C0007", name: "さくら" },
        { name: "あたらしい子" },
      ],
    }));

    const created = await prisma.cast.findFirstOrThrow({ where: { name: "あたらしい子" } });
    expect(created.castCode).toBe("C0008");
  });

  it("CSVで明示されたコードと自動採番が衝突しない", async () => {
    await bulkPOST(bulkReq({
      masters: [
        { name: "コード無し" },   // 自動採番
        { castCode: "C0001", name: "コードあり" },
      ],
    }));

    const codes = (await prisma.cast.findMany({ orderBy: { castCode: "asc" } })).map(m => m.castCode);
    expect(new Set(codes).size).toBe(2);
    expect(codes).toContain("C0001");
  });

  it("CSV内でキャストコードが重複していたら取り込まない", async () => {
    const res = await bulkPOST(bulkReq({
      masters: [
        { castCode: "C0001", name: "A" },
        { castCode: "C0001", name: "B" },
      ],
    }));

    expect(res.status).toBe(400);
    expect(await prisma.cast.count()).toBe(0);
  });

  it("CSV内でHP名が重複していたら取り込まない", async () => {
    const res = await bulkPOST(bulkReq({
      masters: [{ name: "さくら" }, { name: "さくら" }],
    }));

    expect(res.status).toBe(400);
    expect(await prisma.cast.count()).toBe(0);
  });

  it("ADMIN以外は取り込めない", async () => {
    session.current = { userId: "u", role: "CUSTOMER" };
    const res = await bulkPOST(bulkReq({ masters: [{ name: "さくら" }] }));
    expect(res.status).toBe(403);
  });
});

describe("同期API（サーバー間・読み取り専用）", () => {
  it("トークンが無ければ401", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    const res = await syncGET(syncReq());
    expect(res.status).toBe(401);
  });

  it("トークンが違えば401", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    const res = await syncGET(syncReq("wrong-token"));
    expect(res.status).toBe(401);
  });

  it("SYNC_API_TOKEN が未設定なら常に401（設定漏れで開放しない）", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "");
    const res = await syncGET(syncReq("anything"));
    expect(res.status).toBe(401);
  });

  it("正しいトークンなら退職者も含めて返す", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    await prisma.cast.createMany({
      data: [
        { castCode: "C0001", name: "さくら", rank: "S" },
        { castCode: "C0002", name: "みお", retired: true },
      ],
    });

    const res = await syncGET(syncReq("secret-token"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.casts.map((c: { castCode: string }) => c.castCode)).toEqual(["C0001", "C0002"]);
  });

  it("所属店舗を返す（掛け持ちは複数、主たる店舗が先頭）", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    const store = await prisma.store.findFirstOrThrow();
    const store2 = await prisma.store.create({
      data: { slug: "sub-store", name: "サブ店", address: "-", mapQuery: "-" },
    });
    await prisma.cast.create({
      data: {
        castCode: "C0001",
        name: "さくら",
        stores: {
          create: [
            { storeId: store2.id, isPrimary: false },
            { storeId: store.id, isPrimary: true },
          ],
        },
      },
    });

    const res = await syncGET(syncReq("secret-token"));
    const body = await res.json();
    const cast = body.casts[0];

    expect(cast.stores).toHaveLength(2);
    expect(cast.stores[0].isPrimary).toBe(true);
    expect(cast.primaryStoreCode).toBe(store.slug);
  });

  it("activeOnly=true なら退職者を除く", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    await prisma.cast.createMany({
      data: [
        { castCode: "C0001", name: "さくら" },
        { castCode: "C0002", name: "みお", retired: true },
      ],
    });

    const res = await syncGET(syncReq("secret-token", "?activeOnly=true"));
    const body = await res.json();

    expect(body.count).toBe(1);
    expect(body.casts[0].castCode).toBe("C0001");
  });
});

describe("castCode の採番", () => {
  it("4桁ゼロ埋めで、1万を超えたら桁が伸びる", () => {
    expect(formatCastCode(1)).toBe("C0001");
    expect(formatCastCode(12)).toBe("C0012");
    expect(formatCastCode(10000)).toBe("C10000");
  });

  it("形式に合わない値は 0 として扱う", () => {
    expect(parseCastCode("C0012")).toBe(12);
    expect(parseCastCode("")).toBe(0);
    expect(parseCastCode("さくら")).toBe(0);
  });

  it("空き番号を再利用せず、最大値の次から振る", () => {
    const allocate = createCastCodeAllocator(["C0001", "C0005", ""]);
    expect(allocate()).toBe("C0006");
    expect(allocate()).toBe("C0007");
  });
});
