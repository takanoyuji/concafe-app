/**
 * みせ勤（自社の勤怠アプリ）から人件費の入力を作る。
 *
 * 給与計算の「基本給・通勤手当・労働時間」は、これまでエアシフトの
 * 「概算人件費シミュレーション」CSVを手でアップロードして取っていた。
 * みせ勤の attendance API は1打刻ごとに 実労働分・その日の時給・交通費 を返すので、
 * 同じ3項目をここで組み立てる（会計アプリ stagegate-accounting と同じ式）。
 *
 *   基本給   = Σ round(workMinutes / 60 × hourlyWage)   ※打刻ごとに丸める（エアシフトの日別と同じ）
 *   通勤手当 = Σ transportationAmount
 *   労働時間 = Σ workMinutes
 *
 * 深夜割増は見ない。エアシフトCSVの「基本給」列にも含まれていないので現行と同じ。
 *
 * 名寄せは みせ勤の社員コード ＝ キャストマスタの castCode（2026-09-17 に28人分を投入済み）。
 * 表示名では突き合わせない（「月瀬透」vs「透」のような揺れがすでにある）。
 *
 * ⚠️ 黙って0にしない。時給が未登録・退勤打刻が無い打刻があれば、計算せずに止めて該当者を列挙する。
 * 0のまま計算が「成功」すると、基本給が抜けた給与がそれらしく出てしまう。
 */

/** みせ勤が落ちている・設定が違う・データが揃っていない、を呼び出し元に伝える。API側で400/502にする */
export class MisekinError extends Error {
  constructor(message: string, readonly status: 400 | 502 = 502) {
    super(message);
    this.name = "MisekinError";
  }
}

export type MisekinStoreCode = "tokyo" | "osaka" | "nagoya";

/** attendance API の1件。使う項目だけ */
export interface MisekinAttendance {
  staffId: string;
  staffName: string;
  staffEmployeeCode: string | null;
  businessDate: string;          // YYYY-MM-DD
  workMinutes: number | null;    // 退勤前は null
  hourlyWage: number | null;     // 未登録なら null
  transportationAmount: number;
  status: string;                // COMPLETED / IN_PROGRESS / MISSING_CLOCK_OUT / ...
}

/** キャストコード別の人件費。calculateSalaryFromRows() が CSV の代わりに受ける */
export interface WageEntry {
  basic: number;
  commute: number;
  laborTimes: string[];          // "H:MM" を打刻ごとに
}

export interface MisekinWages {
  kind: "misekin";
  byCastCode: Map<string, WageEntry>;
  /** 社員コードが空、またはキャストマスタに無い人。計算からは外れる（CSVで氏名が合わない人と同じ扱い） */
  orphans: { staffName: string; employeeCode: string | null; minutes: number }[];
  /** 取り込んだ打刻数 */
  count: number;
}

/** 環境変数が揃っているときだけ選べる。未設定なら画面に出さない */
export function isMisekinConfigured(): boolean {
  return Boolean(process.env.MISEKIN_API_URL && process.env.MISEKIN_API_KEY);
}

/** 店舗コード → みせ勤の storeId。店舗名で引くと改名で壊れるので、IDを環境変数に持つ */
export function misekinStoreId(storeCode: MisekinStoreCode): string | null {
  const key = `MISEKIN_STORE_ID_${storeCode.toUpperCase()}`;
  return process.env[key] || null;
}

/**
 * 指定店舗・期間の打刻を全ページ取得する。from/to は YYYY-MM-DD（営業日で絞る）。
 * 取れなかったときは 0件を返さずに例外にする。
 */
export async function fetchMisekinAttendance(
  storeCode: MisekinStoreCode,
  from: string,
  to: string
): Promise<MisekinAttendance[]> {
  const base = process.env.MISEKIN_API_URL;
  const key = process.env.MISEKIN_API_KEY;
  if (!base || !key) {
    throw new MisekinError("みせ勤の接続設定（MISEKIN_API_URL / MISEKIN_API_KEY）がありません");
  }
  const storeId = misekinStoreId(storeCode);
  if (!storeId) {
    throw new MisekinError(`みせ勤の店舗ID（MISEKIN_STORE_ID_${storeCode.toUpperCase()}）がありません`);
  }

  const rows: MisekinAttendance[] = [];
  const limit = 100;
  for (let page = 1; page <= 50; page++) {
    const url =
      `${base.replace(/\/$/, "")}/api/v1/attendance` +
      `?storeId=${encodeURIComponent(storeId)}&from=${from}&to=${to}&page=${page}&limit=${limit}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      throw new MisekinError(`みせ勤に接続できませんでした（${e instanceof Error ? e.message : String(e)}）`);
    }
    if (!res.ok) {
      throw new MisekinError(`みせ勤が HTTP ${res.status} を返しました（APIキーとスコープを確認）`);
    }
    const json = (await res.json()) as { data?: MisekinAttendance[]; pagination?: { hasNextPage?: boolean } };
    if (!Array.isArray(json.data)) {
      throw new MisekinError("みせ勤の応答が想定と違います（data がありません）");
    }
    rows.push(...json.data);
    if (!json.pagination?.hasNextPage) break;
  }
  return rows;
}

/** 分 → "H:MM"。エアシフトCSVの労働時間と同じ表記 */
export function minutesToHm(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * 打刻をキャストコード別の人件費にまとめる。
 *
 * @param knownCastCodes キャストマスタにある castCode。無い人は orphans に回す
 * @throws MisekinError 退勤打刻なし／時給未登録があるとき（計算させない）
 */
export function buildWagesFromAttendance(
  rows: MisekinAttendance[],
  knownCastCodes: Set<string>
): MisekinWages {
  const noClockOut: string[] = [];
  const noWage = new Set<string>();

  for (const r of rows) {
    if (r.workMinutes == null) {
      noClockOut.push(`${r.businessDate} ${r.staffName}`);
      continue;
    }
    if (r.workMinutes > 0 && r.hourlyWage == null) {
      noWage.add(r.staffName);
    }
  }
  if (noClockOut.length > 0) {
    throw new MisekinError(
      `退勤打刻が無い勤怠が ${noClockOut.length} 件あります: ${noClockOut.slice(0, 10).join("、")}` +
      `${noClockOut.length > 10 ? " ほか" : ""}。みせ勤で直してから計算してください`,
      400
    );
  }
  if (noWage.size > 0) {
    throw new MisekinError(
      `みせ勤に時給が登録されていない人がいます: ${[...noWage].join("、")}。` +
      `みせ勤のスタッフ設定で時給を入れてから計算してください（未登録のまま0円で計算はしません）`,
      400
    );
  }

  const byCastCode = new Map<string, WageEntry>();
  const orphanMap = new Map<string, { staffName: string; employeeCode: string | null; minutes: number }>();
  for (const r of rows) {
    const minutes = r.workMinutes ?? 0;
    const code = (r.staffEmployeeCode ?? "").trim();
    if (!code || !knownCastCodes.has(code)) {
      const o = orphanMap.get(r.staffId) ?? { staffName: r.staffName, employeeCode: code || null, minutes: 0 };
      o.minutes += minutes;
      orphanMap.set(r.staffId, o);
      continue;
    }
    const e = byCastCode.get(code) ?? { basic: 0, commute: 0, laborTimes: [] };
    e.basic += Math.round((minutes / 60) * (r.hourlyWage ?? 0));
    e.commute += r.transportationAmount ?? 0;
    e.laborTimes.push(minutesToHm(minutes));
    byCastCode.set(code, e);
  }

  return { kind: "misekin", byCastCode, orphans: [...orphanMap.values()], count: rows.length };
}
