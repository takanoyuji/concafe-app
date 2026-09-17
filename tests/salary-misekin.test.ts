import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { calculateSalary, type CastInput } from "@/lib/salary";
import { buildWagesFromAttendance, minutesToHm, MisekinError, type MisekinAttendance, type CastWageTerms } from "@/lib/misekin";

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

/** ランク制度の時給とマスタの日額。みせ勤側の hourlyWage / transportationAmount は見ない */
const terms = (o: Record<string, Partial<CastWageTerms>> = {}): Map<string, CastWageTerms> =>
  new Map(Object.entries({ C0001: {} as Partial<CastWageTerms>, ...o }).map(([code, t]) => [code, { rank: t.rank ?? "シルバー", hourlyWage: t.hourlyWage ?? 1500, commuteDaily: t.commuteDaily ?? 500 }]));

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
  it("実労働×ランクの時給を打刻ごとに丸めて足し、通勤手当は日額×出勤日数、労働時間も合算する", () => {
    const w = buildWagesFromAttendance([
      att({ businessDate: "2026-09-01", workMinutes: 390 }), // 6:30 × 1500 = 9750
      att({ businessDate: "2026-09-02", workMinutes: 61 }),  // 1:01 × 1500 = 1525
      att({ businessDate: "2026-09-02", workMinutes: 30 }),  // 同じ営業日にもう1打刻 → 出勤日数は増えない
    ], terms());
    const e = w.byCastCode.get("C0001")!;
    expect(e.basic).toBe(9750 + 1525 + 750);
    expect(e.commute).toBe(500 * 2);
    expect(e.laborTimes).toEqual(["6:30", "1:01", "0:30"]);
    expect(w.orphans).toEqual([]);
    expect(w.count).toBe(3);
  });

  it("みせ勤側の時給・交通費は使わない（制度表とマスタが正）", () => {
    const w = buildWagesFromAttendance([
      att({ workMinutes: 60, hourlyWage: 9999, transportationAmount: 9999 }),
    ], terms({ C0001: { hourlyWage: 1200, commuteDaily: 360 } }));
    expect(w.byCastCode.get("C0001")).toEqual({ basic: 1200, commute: 360, laborTimes: ["1:00"] });
  });

  it("0分の打刻は出勤日数に数えない", () => {
    const w = buildWagesFromAttendance([att({ workMinutes: 0 })], terms());
    expect(w.byCastCode.get("C0001")!.commute).toBe(0);
  });

  it("社員コードが空、またはマスタに無い人は計算に入れず orphans に出す（黙って落とさない）", () => {
    const w = buildWagesFromAttendance([
      att({}),
      att({ staffId: "s2", staffName: "内勤A", staffEmployeeCode: null, workMinutes: 120 }),
      att({ staffId: "s3", staffName: "新人B", staffEmployeeCode: "C9999", workMinutes: 60 }),
    ], terms());
    expect([...w.byCastCode.keys()]).toEqual(["C0001"]);
    expect(w.orphans).toEqual([
      { staffName: "内勤A", employeeCode: null, minutes: 120 },
      { staffName: "新人B", employeeCode: "C9999", minutes: 60 },
    ]);
  });

  it("ランクの時給が未設定（0）の人に打刻があれば計算せずに止め、名前とランクを列挙する", () => {
    expect(() => buildWagesFromAttendance([
      att({}),
      att({ staffId: "s2", staffName: "やっぴー", staffEmployeeCode: "C0025", workMinutes: 60 }),
    ], terms({ C0025: { rank: "内勤", hourlyWage: 0 } }))).toThrow(/時給が設定されていない.*やっぴー（内勤）/);
  });

  it("退勤打刻が無い勤怠があれば止める", () => {
    expect(() => buildWagesFromAttendance([
      att({ businessDate: "2026-09-03", workMinutes: null, status: "MISSING_CLOCK_OUT" }),
    ], terms())).toThrow(/退勤打刻が無い.*2026-09-03 さくら/);
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
    const wages = buildWagesFromAttendance([att({})], terms());
    const fromMisekin = calculateSalary(salesBuf(), wages, CASTS);
    expect(fromMisekin.casts).toEqual(fromCsv.casts);
    expect(fromMisekin.workHours).toBe(fromCsv.workHours);
    expect(fromMisekin.laborCost).toBe(fromCsv.laborCost);
  });

  it("鍵はキャストコードで、エアシフト名が空でも引ける", () => {
    const casts: CastInput[] = [{ ...CASTS[0], airShiftName: "" }];
    const wages = buildWagesFromAttendance([att({})], terms());
    const r = calculateSalary(salesBuf(), wages, casts);
    expect(r.casts[0].basicPay).toBe(9750);
    expect(r.casts[0].commute).toBe(500);
  });
});

describe("交通費○/×はランク表（commutePaid）で決める", () => {
  const wagesWithCommute = () => buildWagesFromAttendance([att({})], terms({ C0001: { commuteDaily: 500 } }));

  it("commutePaid=false なら通勤手当を0にする（ランク名が従来リストに無くても）", () => {
    const casts: CastInput[] = [{ ...CASTS[0], rank: "新ランク", commutePaid: false }];
    const r = calculateSalary(salesBuf(), wagesWithCommute(), casts);
    expect(r.casts[0].commute).toBe(0);
  });

  it("commutePaid=true なら残す（ゴールドでも表が○なら払う）", () => {
    const casts: CastInput[] = [{ ...CASTS[0], rank: "ゴールド", commutePaid: true }];
    const r = calculateSalary(salesBuf(), wagesWithCommute(), casts);
    expect(r.casts[0].commute).toBe(500);
  });

  it("commutePaid を渡さなければ従来の固定リスト（ゴールド以上は0）", () => {
    const gold: CastInput[] = [{ ...CASTS[0], rank: "ゴールド" }];
    const silver: CastInput[] = [{ ...CASTS[0], rank: "シルバー" }];
    expect(calculateSalary(salesBuf(), wagesWithCommute(), gold).casts[0].commute).toBe(0);
    expect(calculateSalary(salesBuf(), wagesWithCommute(), silver).casts[0].commute).toBe(500);
  });
});
