import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import iconv from "iconv-lite";

const session = vi.hoisted(() => ({ current: null as null | { userId: string; role: string } }));
vi.mock("@/lib/auth", () => ({
  getSession: async () => session.current,
}));

import { prisma } from "@/lib/prisma";
import { calculateSalary, decodeCsv, CsvFormatError } from "@/lib/salary";
import { POST as salaryPOST } from "@/app/api/admin/salary/route";

const SALES_HEADER = ["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"];
const WAGE_HEADER  = ["氏名", "基本給", "通勤手当", "労働時間"];
const SALES_ROW    = ["ドリンク", "サクラ", "内税", "10000", "8000", "10"];
const WAGE_ROW     = ["佐倉花子", "9000", "500", "6:30"];

const csvText = (header: string[], rows: string[][]) =>
  [header, ...rows].map(r => r.join(",")).join("\r\n");

const asSjis  = (t: string) => new Uint8Array(iconv.encode(t, "shift_jis")).buffer as ArrayBuffer;
const asUtf8  = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer;
const asUtf8Bom = (t: string) => new TextEncoder().encode("﻿" + t).buffer as ArrayBuffer;

const CASTS = [{
  castCode: "C9002",
  castName: "サクラ", airShiftName: "佐倉花子", rank: "シルバー",
  backRate: 0.3, exemptFromCommuteRule: false,
}];

// 他のテストファイルは「キャストが1件も無い」前提で beforeAll を書いているため、
// このファイルが作ったレコードは必ず片付ける（実行順によって他が落ちる）
afterAll(async () => {
  await prisma.salaryPeriod.deleteMany({ where: { storeName: "東京" } });
  await prisma.castStore.deleteMany();
  await prisma.cast.deleteMany();
  await prisma.castRank.deleteMany();
});

describe("CSVの文字コード判定", () => {
  const sales = csvText(SALES_HEADER, [SALES_ROW]);
  const wage  = csvText(WAGE_HEADER,  [WAGE_ROW]);

  it("Shift-JIS の売上CSVを読める（従来の書き出し）", () => {
    const r = calculateSalary(asSjis(sales), asUtf8(wage), CASTS);
    expect(r.totalSalesTaxIncl).toBe(10000);
    expect(r.casts[0].totalSales).toBe(10000);
  });

  it("UTF-8(BOM付き) の売上CSVでも同じ結果になる", () => {
    const r = calculateSalary(asUtf8Bom(sales), asUtf8Bom(wage), CASTS);
    expect(r.totalSalesTaxIncl).toBe(10000);
    expect(r.casts[0].totalSales).toBe(10000);
    expect(r.casts[0].basicPay).toBe(9000);
  });

  it("UTF-8(BOM無し) の売上CSVでも同じ結果になる", () => {
    const r = calculateSalary(asUtf8(sales), asUtf8(wage), CASTS);
    expect(r.totalSalesTaxIncl).toBe(10000);
    expect(r.casts[0].totalSales).toBe(10000);
  });

  it("Shift-JIS と UTF-8 で復号結果が一致する", () => {
    expect(decodeCsv(asSjis(sales))).toBe(decodeCsv(asUtf8(sales)));
    expect(decodeCsv(asUtf8Bom(sales))).toBe(decodeCsv(asUtf8(sales)));
    // BOM が文字として残っていない（残ると1列目のヘッダーが一致しなくなる）
    expect(decodeCsv(asUtf8Bom(sales)).startsWith("商品名")).toBe(true);
  });
});

describe("列が揃わないCSVは計算せずに止める", () => {
  it("売上CSVの列が欠けていたら CsvFormatError（0を返さない）", () => {
    const broken = csvText(["商品名", "カテゴリー", "税区分"], [["ドリンク", "サクラ", "内税"]]);
    expect(() => calculateSalary(asUtf8(broken), asUtf8(csvText(WAGE_HEADER, [WAGE_ROW])), CASTS))
      .toThrow(CsvFormatError);
  });

  it("人件費CSVの列が欠けていたら CsvFormatError", () => {
    const broken = csvText(["氏名", "日付"], [["佐倉花子", "2026/08/01"]]);
    expect(() => calculateSalary(asUtf8(csvText(SALES_HEADER, [SALES_ROW])), asUtf8(broken), CASTS))
      .toThrow(CsvFormatError);
  });

  it("データ行が無ければ CsvFormatError", () => {
    expect(() => calculateSalary(asUtf8(csvText(SALES_HEADER, [])), asUtf8(csvText(WAGE_HEADER, [WAGE_ROW])), CASTS))
      .toThrow(CsvFormatError);
  });

  it("エラーメッセージに欠けている列名と読み取れた列が入る", () => {
    const broken = csvText(["商品名", "カテゴリー", "税区分"], [["ドリンク", "サクラ", "内税"]]);
    try {
      calculateSalary(asUtf8(broken), asUtf8(csvText(WAGE_HEADER, [WAGE_ROW])), CASTS);
      throw new Error("例外が投げられなかった");
    } catch (e) {
      expect(e).toBeInstanceOf(CsvFormatError);
      const msg = (e as Error).message;
      expect(msg).toContain("販売総売上");
      expect(msg).toContain("粗利総額");
      expect(msg).toContain("商品名");   // 読み取れた列の提示
    }
  });
});

describe("APIは形式不正を400で返す", () => {
  beforeEach(async () => {
    session.current = { userId: "admin", role: "ADMIN" };
    await prisma.salaryPeriod.deleteMany({ where: { storeName: "東京" } });
    await prisma.castStore.deleteMany();
    await prisma.cast.deleteMany();
    await prisma.castRank.deleteMany();
    await prisma.castRank.create({ data: { name: "シルバー", backRate: 0.3 } });
    await prisma.cast.create({
      data: { castCode: "C9002", name: "さくら", rank: "シルバー", tokyoAirRegi: "サクラ", tokyoAirShift: "佐倉花子" },
    });
  });

  function req(salesBuf: ArrayBuffer, wageBuf: ArrayBuffer) {
    const form = new FormData();
    form.append("store", "東京");
    // 2026-09 に給与APIの既定が Airレジ API へ移った。ここは売上CSV経路の試験なので明示する
    form.append("source", "csv");
    form.append("salesCsv", new File([salesBuf], "sales.csv"));
    form.append("wageCsv",  new File([wageBuf],  "wage.csv"));
    form.append("year", "2026"); form.append("month", "8"); form.append("half", "1");
    return new Request("http://localhost/api/admin/salary", { method: "POST", body: form });
  }

  it("列が足りないCSVは400になり、DBに保存されない", async () => {
    const broken = csvText(["商品名", "カテゴリー", "税区分"], [["ドリンク", "サクラ", "内税"]]);
    const res = await salaryPOST(req(asUtf8(broken), asUtf8(csvText(WAGE_HEADER, [WAGE_ROW]))));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("売上CSV");
    expect(await prisma.salaryPeriod.count({ where: { storeName: "東京" } })).toBe(0);
  });

  it("UTF-8のCSVは400にならず、売上が0にならない", async () => {
    const res = await salaryPOST(req(
      asUtf8Bom(csvText(SALES_HEADER, [SALES_ROW])),
      asUtf8Bom(csvText(WAGE_HEADER,  [WAGE_ROW])),
    ));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalSalesTaxIncl).toBe(10000);
    expect(body.summary.casts[0].totalSales).toBe(10000);
  });
});
