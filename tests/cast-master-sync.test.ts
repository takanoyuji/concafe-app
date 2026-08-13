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
  await prisma.castMaster.deleteMany();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CSV一括取込（upsert）", () => {
  it("取込後も月次ランクの履歴が残り、レコードが作り直されない", async () => {
    const m = await prisma.castMaster.create({
      data: { castCode: "C0001", hpName: "さくら", rank: "S" },
    });
    await prisma.castMonthlyRank.createMany({
      data: [
        { castMasterId: m.id, year: 2026, month: 6, rank: "A" },
        { castMasterId: m.id, year: 2026, month: 7, rank: "S" },
      ],
    });

    const res = await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", hpName: "さくら", rank: "S" }] }));
    expect(res.status).toBe(200);

    // 以前は deleteMany で cascade 削除されていた
    expect(await prisma.castMonthlyRank.count()).toBe(2);

    const after = await prisma.castMaster.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.id).toBe(m.id);
  });

  it("CSVに退職列が無いとき、退職フラグが維持される", async () => {
    await prisma.castMaster.create({
      data: { castCode: "C0001", hpName: "みお", rank: "B", retired: true },
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", hpName: "みお", rank: "B" }] }));

    // 以前は毎回 false に戻り、退職者が給与集計に復活していた
    const after = await prisma.castMaster.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.retired).toBe(true);
  });

  it("CSVに退職列があればその値で更新される", async () => {
    await prisma.castMaster.create({
      data: { castCode: "C0001", hpName: "みお", rank: "B", retired: true },
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", hpName: "みお", retired: false }] }));

    const after = await prisma.castMaster.findUniqueOrThrow({ where: { castCode: "C0001" } });
    expect(after.retired).toBe(false);
  });

  it("CSVに載っていない既存キャストは退職扱いになり、件数が返る", async () => {
    await prisma.castMaster.createMany({
      data: [
        { castCode: "C0001", hpName: "さくら" },
        { castCode: "C0002", hpName: "ゆい" },
      ],
    });

    const res = await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", hpName: "さくら" }] }));
    const body = await res.json();

    expect(body.retiredCasts).toEqual([{ castCode: "C0002", hpName: "ゆい" }]);
    const yui = await prisma.castMaster.findUniqueOrThrow({ where: { castCode: "C0002" } });
    expect(yui.retired).toBe(true);
    // レコードは消さないので、管理画面でチェックを外せば戻せる
    expect(await prisma.castMaster.count()).toBe(2);
  });

  it("retireMissing:false なら CSV未掲載でも退職扱いにしない", async () => {
    await prisma.castMaster.createMany({
      data: [
        { castCode: "C0001", hpName: "さくら" },
        { castCode: "C0002", hpName: "ゆい" },
      ],
    });

    await bulkPOST(bulkReq({ masters: [{ castCode: "C0001", hpName: "さくら" }], retireMissing: false }));

    const yui = await prisma.castMaster.findUniqueOrThrow({ where: { castCode: "C0002" } });
    expect(yui.retired).toBe(false);
  });

  it("castCode 列が無い旧CSVは HP名で既存に突き合わせる（重複作成しない）", async () => {
    const m = await prisma.castMaster.create({ data: { castCode: "C0001", hpName: "さくら", rank: "A" } });

    const res = await bulkPOST(bulkReq({ masters: [{ hpName: "さくら", rank: "S" }] }));
    const body = await res.json();

    expect(body.created).toBe(0);
    expect(body.updated).toBe(1);
    expect(await prisma.castMaster.count()).toBe(1);

    const after = await prisma.castMaster.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.rank).toBe("S");
    expect(after.castCode).toBe("C0001"); // コードは変わらない
  });

  it("新規行には既存の続きから castCode が採番される", async () => {
    await prisma.castMaster.create({ data: { castCode: "C0007", hpName: "さくら" } });

    await bulkPOST(bulkReq({
      masters: [
        { castCode: "C0007", hpName: "さくら" },
        { hpName: "あたらしい子" },
      ],
    }));

    const created = await prisma.castMaster.findFirstOrThrow({ where: { hpName: "あたらしい子" } });
    expect(created.castCode).toBe("C0008");
  });

  it("CSVで明示されたコードと自動採番が衝突しない", async () => {
    await bulkPOST(bulkReq({
      masters: [
        { hpName: "コード無し" },   // 自動採番
        { castCode: "C0001", hpName: "コードあり" },
      ],
    }));

    const codes = (await prisma.castMaster.findMany({ orderBy: { castCode: "asc" } })).map(m => m.castCode);
    expect(new Set(codes).size).toBe(2);
    expect(codes).toContain("C0001");
  });

  it("CSV内でキャストコードが重複していたら取り込まない", async () => {
    const res = await bulkPOST(bulkReq({
      masters: [
        { castCode: "C0001", hpName: "A" },
        { castCode: "C0001", hpName: "B" },
      ],
    }));

    expect(res.status).toBe(400);
    expect(await prisma.castMaster.count()).toBe(0);
  });

  it("CSV内でHP名が重複していたら取り込まない", async () => {
    const res = await bulkPOST(bulkReq({
      masters: [{ hpName: "さくら" }, { hpName: "さくら" }],
    }));

    expect(res.status).toBe(400);
    expect(await prisma.castMaster.count()).toBe(0);
  });

  it("ADMIN以外は取り込めない", async () => {
    session.current = { userId: "u", role: "CUSTOMER" };
    const res = await bulkPOST(bulkReq({ masters: [{ hpName: "さくら" }] }));
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
    await prisma.castMaster.createMany({
      data: [
        { castCode: "C0001", hpName: "さくら", rank: "S" },
        { castCode: "C0002", hpName: "みお", retired: true },
      ],
    });

    const res = await syncGET(syncReq("secret-token"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.casts.map((c: { castCode: string }) => c.castCode)).toEqual(["C0001", "C0002"]);
  });

  it("activeOnly=true なら退職者を除く", async () => {
    vi.stubEnv("SYNC_API_TOKEN", "secret-token");
    await prisma.castMaster.createMany({
      data: [
        { castCode: "C0001", hpName: "さくら" },
        { castCode: "C0002", hpName: "みお", retired: true },
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
