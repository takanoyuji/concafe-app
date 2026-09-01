import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import iconv from "iconv-lite";

const session = vi.hoisted(() => ({ current: null as null | { userId: string; role: string } }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => session.current,
}));

import { prisma } from "@/lib/prisma";
import { POST as salaryPOST } from "@/app/api/admin/salary/route";

const STORE = "東京";

// 売上CSVはエアレジの書き出しに合わせて Shift-JIS
function salesCsv(rows: string[][]): File {
  const header = ["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"];
  const text = [header, ...rows].map(r => r.join(",")).join("\r\n");
  return new File([new Uint8Array(iconv.encode(text, "shift_jis"))], "sales.csv");
}

// 勤怠CSVは UTF-8
function wageCsv(rows: string[][]): File {
  const header = ["氏名", "基本給", "通勤手当", "労働時間"];
  const text = [header, ...rows].map(r => r.join(",")).join("\r\n");
  return new File([text], "wage.csv", { type: "text/csv" });
}

function salaryReq(opts: { sales: File; wage: File; year?: number; month?: number; half?: number; save?: boolean }) {
  const form = new FormData();
  form.append("store", STORE);
  form.append("salesCsv", opts.sales);
  form.append("wageCsv", opts.wage);
  if (opts.year)  form.append("year",  String(opts.year));
  if (opts.month) form.append("month", String(opts.month));
  if (opts.half)  form.append("half",  String(opts.half));
  // 期間を送っても、保存の意思（save）が無ければDBには入らない
  if (opts.save ?? Boolean(opts.year && opts.month && opts.half)) form.append("save", "1");
  return new Request("http://localhost/api/admin/salary", { method: "POST", body: form });
}

beforeEach(async () => {
  session.current = { userId: "admin", role: "ADMIN" };
  await prisma.salaryPeriod.deleteMany({ where: { storeName: STORE } });
  await prisma.castMonthlyRank.deleteMany();
  await prisma.castStore.deleteMany();
  await prisma.cast.deleteMany();
  await prisma.castRank.deleteMany();

  await prisma.castRank.create({ data: { name: "シルバー", backRate: 0.3 } });
  await prisma.cast.create({
    data: {
      castCode: "C9001", name: "さくら", rank: "シルバー",
      tokyoAirRegi: "サクラ", tokyoAirShift: "佐倉花子",
    },
  });
});

// 他のテストファイルは「キャストが1件も無い」前提で beforeAll を書いているため、
// このファイルが作ったレコードは必ず片付ける（実行順によって他が落ちる）
afterAll(async () => {
  await prisma.salaryPeriod.deleteMany({ where: { storeName: STORE } });
  await prisma.castStore.deleteMany();
  await prisma.cast.deleteMany();
  await prisma.castRank.deleteMany();
});

describe("給与計算のDB保存", () => {
  it("期間を指定すると SalaryPeriod・キャスト明細・サマリーが保存される", async () => {
    const res = await salaryPOST(salaryReq({
      sales: salesCsv([["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]),
      wage:  wageCsv([["佐倉花子", "9000", "500", "6:30"]]),
      year: 2026, month: 8, half: 1,
    }));

    // 保存に失敗していると 500 になる。本文まで出して原因が分かるようにする
    const body = await res.json().catch(() => null);
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.periodId).toBeTruthy();

    const period = await prisma.salaryPeriod.findUniqueOrThrow({
      where: { id: body.periodId },
      include: { castRecords: true, summaryRecord: true },
    });
    expect(period.summaryRecord).not.toBeNull();
    expect(period.castRecords).toHaveLength(1);

    const record = period.castRecords[0];
    // castName はエアレジ名、hpName は Cast.name。列名を取り違えると保存自体が落ちる
    expect(record.castName).toBe("サクラ");
    expect(record.hpName).toBe("さくら");
    expect(record.rank).toBe("シルバー");
    // 基本給9000 + 通勤500 + バック(粗利7000 × 0.3) = 11600
    expect(record.basicPay).toBe(9000);
    expect(record.commute).toBe(500);
    expect(record.payment).toBe(11600);
  });

  it("同じ期間を計算し直すと二重に増えず、上書きされる", async () => {
    const args = {
      sales: salesCsv([["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]),
      wage:  wageCsv([["佐倉花子", "9000", "500", "6:30"]]),
      year: 2026, month: 8, half: 2,
    };
    const first  = await salaryPOST(salaryReq(args));
    expect(first.status).toBe(200);
    const second = await salaryPOST(salaryReq({ ...args, sales: salesCsv([["ドリンク", "サクラ", "内税", "20000", "16000", "20"]]) }));
    expect(second.status).toBe(200);

    const periods = await prisma.salaryPeriod.findMany({
      where: { storeName: STORE, year: 2026, month: 8, half: 2 },
      include: { castRecords: true },
    });
    expect(periods).toHaveLength(1);
    expect(periods[0].castRecords).toHaveLength(1);
    // 2回目の売上で上書きされている（粗利14000 × 0.3 + 9500 = 13700）
    expect(periods[0].castRecords[0].payment).toBe(13700);
  });

  it("期間を送っても save を付けなければ計算結果だけ返し、DBには保存しない", async () => {
    const res = await salaryPOST(salaryReq({
      sales: salesCsv([["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]),
      wage:  wageCsv([["佐倉花子", "9000", "500", "6:30"]]),
      year: 2026, month: 8, half: 1, save: false,
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.periodId).toBeUndefined();
    expect(body.summary.casts).toHaveLength(1);
    expect(await prisma.salaryPeriod.count({ where: { storeName: STORE } })).toBe(0);
  });

  it("ADMIN でなければ 403", async () => {
    session.current = { userId: "u1", role: "USER" };
    const res = await salaryPOST(salaryReq({
      sales: salesCsv([["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]),
      wage:  wageCsv([["佐倉花子", "9000", "500", "6:30"]]),
      year: 2026, month: 8, half: 1,
    }));
    expect(res.status).toBe(403);
  });
});
