/**
 * 最低賃金の判定。
 *
 * ランク制度表の時給（ゴールド/シルバー 1,200・ブロンズ/研修 1,100 等）は地域の最低賃金を下回るが、
 * バック（歩合）を足した月間の実額では上回ることが多い。そこで **月間トータル** で判定する（2026-09-17 代表判断）。
 *
 *   時間あたり賃金 = (給与 − 通勤手当) ÷ 労働時間
 *
 * 最低賃金法の比較では 通勤手当・精皆勤手当・家族手当・臨時の賃金・割増賃金 を除き、歩合給は含める。
 * ここでは通勤手当だけ除く（他は給与計算に載っていない）。深夜割増はエアシフトCSVの基本給にも
 * 含まれていないので、この判定はやや厳しめ（安全側）になる。
 *
 * 前半/後半で計算しているときは、もう片方が DB に保存されていれば足して月間にする。
 * 無ければ判定しない（pending）。半月だけで警告すると、バックが偏る月に誤警報になるため。
 *
 * ⚠️ 最低賃金は毎年10月に改定される。改定されたら下の表に行を足すこと（継続タスクに載せてある）。
 */

export type MinWageStoreCode = "tokyo" | "osaka" | "nagoya";

/** 都道府県別の地域別最低賃金（円）。from は発効日（YYYY-MM-DD）。新しい順でなくてよい */
const MIN_WAGE_TABLE: Record<MinWageStoreCode, { pref: string; rates: { from: string; amount: number }[] }> = {
  tokyo:  { pref: "東京", rates: [{ from: "2024-10-01", amount: 1163 }, { from: "2025-10-03", amount: 1226 }] },
  osaka:  { pref: "大阪", rates: [{ from: "2024-10-01", amount: 1114 }, { from: "2025-10-16", amount: 1177 }] },
  nagoya: { pref: "愛知", rates: [{ from: "2024-10-01", amount: 1077 }, { from: "2025-10-18", amount: 1140 }] },
};

/**
 * 指定年月に適用する最低賃金。月内に改定日をまたぐときは高いほう（月末時点）で判定する（安全側）。
 * 表より前の年月なら最も古い行を返す。
 */
export function minimumWageFor(store: MinWageStoreCode, year: number, month: number): { pref: string; amount: number; from: string } {
  const { pref, rates } = MIN_WAGE_TABLE[store];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const sorted = [...rates].sort((a, b) => a.from.localeCompare(b.from));
  let pick = sorted[0];
  for (const r of sorted) if (r.from <= monthEnd) pick = r;
  return { pref, amount: pick.amount, from: pick.from };
}

/** 判定に使う1人分。半月ごとに渡し、同じ castName を足し合わせる */
export interface MinWageInput {
  castName: string;
  /** 給与（100円丸め前）。無ければ payment でもよい */
  salary: number;
  commute: number;
  workMinutes: number;
}

export interface MinWageWarning {
  castName: string;
  workMinutes: number;
  /** 通勤手当を除いた月間の賃金 */
  wage: number;
  /** 時間あたり（円、小数切り捨て） */
  hourly: number;
}

export interface MinWageResult {
  /** checked: 月間で判定した / pending: 前半・後半のもう片方が無く判定していない */
  status: "checked" | "pending";
  pref: string;
  amount: number;
  /** 判定に使った期間の説明（画面表示用） */
  basis: string;
  warnings: MinWageWarning[];
}

/**
 * 月間トータルで最低賃金を下回るキャストを返す。
 *
 * @param current  今回計算した期間の行
 * @param half     今回の期間（0=全月, 1=前半, 2=後半）
 * @param other    もう片方の半月の保存済みの行。half=0 なら不要。無ければ null → pending
 */
export function checkMinimumWage(
  store: MinWageStoreCode,
  year: number,
  month: number,
  half: number,
  current: MinWageInput[],
  other: MinWageInput[] | null
): MinWageResult {
  const { pref, amount } = minimumWageFor(store, year, month);
  const ym = `${year}/${String(month).padStart(2, "0")}`;

  if (half !== 0 && other == null) {
    return {
      status: "pending", pref, amount,
      basis: `${ym} は${half === 1 ? "後半" : "前半"}が未保存のため、月間での判定はまだできません`,
      warnings: [],
    };
  }

  const totals = new Map<string, { wage: number; minutes: number }>();
  for (const row of [...current, ...(other ?? [])]) {
    const t = totals.get(row.castName) ?? { wage: 0, minutes: 0 };
    t.wage += row.salary - row.commute;
    t.minutes += row.workMinutes;
    totals.set(row.castName, t);
  }

  const warnings: MinWageWarning[] = [];
  for (const [castName, t] of totals) {
    if (t.minutes <= 0) continue; // 労働時間の記録が無い（旧レコード）人は判定しない
    const hourly = Math.floor(t.wage / (t.minutes / 60));
    if (hourly < amount) warnings.push({ castName, workMinutes: t.minutes, wage: Math.round(t.wage), hourly });
  }
  warnings.sort((a, b) => a.hourly - b.hourly);

  return {
    status: "checked", pref, amount,
    basis: half === 0 ? `${ym} 全月` : `${ym} 前半＋後半の合計`,
    warnings,
  };
}
