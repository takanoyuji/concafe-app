import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { calculateSalary, type CastInput } from "@/lib/salary";
import { buildWagesFromAttendance, minutesToHm, MisekinError, type MisekinAttendance } from "@/lib/misekin";

const SALES_HEADER = ["商品名", "カテゴリー", "税区分", "販売総売上", "粗利総額", "販売商品数"];
const WAGE_HEADER  = ["氏名", "基本給", "通勤手当", "労働時間"];
const csv = (header: string[], rows: string[][]) => [header, ...rows].map(r => r.join(",")).join("\r\n");
const sjis = (t: string) => new Uint8Array(iconv.encode(t, "shift_jis")).buffer as ArrayBuffer;
const utf8 = (t: string) => new TextEncoder().encode(t).buffer as ArrayBuffer;

const CASTS: CastInput[] = [{
  castCode: "C0001", castName: "サクラ", airShiftName: "佐倉花子",
  rank: "シルバー", backRate: 0.3, exemptFromCommuteRule: false,
}];
const salesBuf = () => sjis(csv(SALES_HEADER, [["ドリンク", "サクラ", "内税", "10000", "8000", "10"]]));

const att = (o: Partial<MisekinAttendance>): MisekinAttendance => ({
  staffId: o.staffId ?? "s1",
  staffName: o.staffName ?? "さくら",
  staffEmployeeCode: o.staffEmployeeCode === undefined ? "C0001" : o.staffEmployeeCode,
  businessDate: o.businessDate ?? "2026-09-01",
  workMinutes: o.workMinutes === undefined ? 390 : o.workMinutes,
  hourlyWage: o.hourlyWage === undefined ? 1500 : o.hourlyWage,
  transportationAmount: o.transportationAmount ?? 500,
  status: o.status ?? "COMPLETED",
});

describe("みせ勤の打刻 → 人件費", () => {
  it("実労働×時給を打刻ごとに丸めて足し、交通費と労働時間も合算する", () => {
    const w = buildWagesFromAttendance([
      att({ businessDate: "2026-09-01", workMinutes: 390, hourlyWage: 1500, transportationAmount: 500 }), // 6:30 → 9750
      att({ businessDate: "2026-09-02", workMinutes: 61,  hourlyWage: 1500, transportationAmount: 500 }), // 1:01 → 1525
    ], new Set(["C0001"]));
    const e = w.byCastCode.get("C0001")!;
    expect(e.basic).toBe(9750 + 1525);
    expect(e.commute).toBe(1000);
    expect(e.laborTimes).toEqual(["6:30", "1:01"]);
    expect(w.orphans).toEqual([]);
    expect(w.count).toBe(2);
  });

  it("社員コードが空、またはマスタに無い人は計算に入れず orphans に出す（黙って落とさない）", () => {
    const w = buildWagesFromAttendance([
      att({}),
      att({ staffId: "s2", staffName: "内勤A", staffEmployeeCode: null, workMinutes: 120 }),
      att({ staffId: "s3", staffName: "新人B", staffEmployeeCode: "C9999", workMinutes: 60 }),
    ], new Set(["C0001"]));
    expect([...w.byCastCode.keys()]).toEqual(["C0001"]);
    expect(w.orphans).toEqual([
      { staffName: "内勤A", employeeCode: null, minutes: 120 },
      { staffName: "新人B", employeeCode: "C9999", minutes: 60 },
    ]);
  });

  it("時給が未登録の人がいれば計算せずに止め、名前を列挙する", () => {
    expect(() => buildWagesFromAttendance([
      att({}),
      att({ staffId: "s2", staffName: "ARIA", staffEmployeeCode: "C0006", hourlyWage: null }),
    ], new Set(["C0001", "C0006"]))).toThrow(/時給が登録されていない.*ARIA/);
  });

  it("退勤打刻が無い勤怠があれば止める", () => {
    expect(() => buildWagesFromAttendance([
      att({ businessDate: "2026-09-03", workMinutes: null, status: "MISSING_CLOCK_OUT" }),
    ], new Set(["C0001"]))).toThrow(/退勤打刻が無い.*2026-09-03 さくら/);
  });

  it("MisekinError はデータ不備なら 400、接続系なら 502 を持つ", () => {
    expect(new MisekinError("x", 400).status).toBe(400);
    expect(new MisekinError("x").status).toBe(502);
  });

  it("分 → H:MM", () => {
    expect(minutesToHm(0)).toBe("0:00");
    expect(minutesToHm(65)).toBe("1:05");
    expect(minutesToHm(600)).toBe("10:00");
  });
});

describe("給与計算に みせ勤の人件費を渡す", () => {
  it("同じ基本給・通勤手当・労働時間なら、人件費CSVと同じ結果になる", () => {
    const fromCsv = calculateSalary(salesBuf(), utf8(csv(WAGE_HEADER, [["佐倉花子", "9750", "500", "6:30"]])), CASTS);
    const wages = buildWagesFromAttendance([att({})], new Set(["C0001"]));
    const fromMisekin = calculateSalary(salesBuf(), wages, CASTS);
    expect(fromMisekin.casts).toEqual(fromCsv.casts);
    expect(fromMisekin.workHours).toBe(fromCsv.workHours);
    expect(fromMisekin.laborCost).toBe(fromCsv.laborCost);
  });

  it("鍵はキャストコードで、エアシフト名が空でも引ける", () => {
    const casts: CastInput[] = [{ ...CASTS[0], airShiftName: "" }];
    const wages = buildWagesFromAttendance([att({})], new Set(["C0001"]));
    const r = calculateSalary(salesBuf(), wages, casts);
    expect(r.casts[0].basicPay).toBe(9750);
    expect(r.casts[0].commute).toBe(500);
  });
});
