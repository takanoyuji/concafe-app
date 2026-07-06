export interface CastInput {
  castName: string;      // キャスト名（売上CSVのカテゴリーと照合）
  airShiftName: string;  // AirShift氏名（勤怠CSVと照合）
  rank: string;          // ランク名
  backRate: number;      // バック率 (0〜1)
  exemptFromCommuteRule: boolean;
}

export interface CastResult {
  castName: string;
  rank: string;
  basicPay: number;
  commute: number;
  grossProfit: number;
  totalSales: number;
  back: number;
  salary: number;
  payment: number;
}

export interface SalarySummary {
  casts: CastResult[];
  tc: number;
  totalSales: number;
  grossProfit: number;
  laborCost: number;
  contributionProfit: number;
  workHours: string;
}

export function decodeShiftJIS(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("shift-jis");
  return decoder.decode(buffer);
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return [];

  // ヘッダー行
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim() ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// 売上CSV行
interface SalesRow {
  商品名: string;
  カテゴリー: string;
  税区分: string;
  販売総売上: number;
  粗利総額: number;
  販売商品数: number;
}

// 勤怠CSV行
interface WageRow {
  氏名: string;
  基本給: number;
  通勤手当: number;
  労働時間: string;
}

export function calculateSalary(
  salesBuf: ArrayBuffer,
  wageBuf: ArrayBuffer,
  casts: CastInput[]
): SalarySummary {
  // --- CSV パース ---
  const salesText = decodeShiftJIS(salesBuf);
  const wageText = new TextDecoder("utf-8").decode(wageBuf);

  const salesRaw = parseCSV(salesText);
  const wageRaw = parseCSV(wageText);

  // --- 売上CSV 数値変換 + インボイス処理 ---
  const sales: SalesRow[] = salesRaw.map(r => {
    const souuri = toNum(r["販売総売上"]);
    let gross = toNum(r["粗利総額"]);
    // 内税インボイス: 粗利 -= 売上 × 0.1
    if (r["税区分"]?.trim() === "内税") {
      gross -= souuri * 0.1;
    }
    return {
      商品名: r["商品名"] ?? "",
      カテゴリー: (r["カテゴリー"] ?? "").replace(/^遠隔_/, ""),
      税区分: r["税区分"] ?? "",
      販売総売上: Math.round(souuri),
      粗利総額: gross,
      販売商品数: toNum(r["販売商品数"]),
    };
  });

  // --- 勤怠CSV 数値変換 ---
  const wages: WageRow[] = wageRaw.map(r => ({
    氏名: r["氏名"] ?? "",
    基本給: toNum(r["基本給"]),
    通勤手当: toNum(r["通勤手当"]),
    労働時間: r["労働時間"] ?? "",
  }));

  // 氏名でgroupby sum
  const wageMap = new Map<string, { basic: number; commute: number; laborTimes: string[] }>();
  for (const w of wages) {
    const key = w.氏名;
    if (!key) continue;
    const existing = wageMap.get(key) ?? { basic: 0, commute: 0, laborTimes: [] };
    existing.basic += w.基本給;
    existing.commute += w.通勤手当;
    existing.laborTimes.push(w.労働時間);
    wageMap.set(key, existing);
  }

  // カテゴリー別 粗利・売上
  const grossMap = new Map<string, number>();
  const salesMap = new Map<string, number>();
  for (const s of sales) {
    const cat = s.カテゴリー;
    grossMap.set(cat, (grossMap.get(cat) ?? 0) + s.粗利総額);
    salesMap.set(cat, (salesMap.get(cat) ?? 0) + s.販売総売上);
  }

  // --- キャスト別計算 ---
  const results: CastResult[] = [];
  const COMMUTE_ZERO_RANKS = ["店長", "プラチナ", "ブラック", "ゴールド"];

  for (const c of casts) {
    const wageEntry = wageMap.get(c.airShiftName) ?? { basic: 0, commute: 0, laborTimes: [] };
    let basicPay = wageEntry.basic;
    let commute = wageEntry.commute;
    const grossProfit = grossMap.get(c.castName) ?? 0;
    const totalSales = salesMap.get(c.castName) ?? 0;

    // 時給計 = 基本給 + 通勤手当
    let hourlyTotal = basicPay + commute;

    const back = grossProfit * c.backRate;

    // ゴールド以上かつ非除外者は通勤手当=0
    if (COMMUTE_ZERO_RANKS.includes(c.rank) && !c.exemptFromCommuteRule) {
      commute = 0;
      hourlyTotal = basicPay; // 通勤手当を除いて再計算
    }

    let salary = hourlyTotal + back;

    // プラチナ特則: 粗利×0.1 > 時給計 なら 給与=粗利×0.6
    if (c.rank === "プラチナ") {
      if (grossProfit * 0.1 > hourlyTotal) {
        salary = grossProfit * 0.6;
      }
    }

    // 支払額 = 100円単位丸め
    const payment = Math.round(salary / 100) * 100;

    results.push({
      castName: c.castName,
      rank: c.rank,
      basicPay,
      commute,
      grossProfit,
      totalSales,
      back,
      salary,
      payment,
    });
  }

  // --- 業績サマリー ---
  // TC計算
  let tc = 0;
  try {
    const tcRow = sales.find(s => s.商品名 === "TC　（1時間）");
    if (tcRow) tc += tcRow.販売商品数;
  } catch { tc = 0; }
  const nomiho = sales.find(s => s.商品名 === "のみほ（30分）");
  if (nomiho) tc += nomiho.販売商品数 * 0.5;
  const tc30 = sales.find(s => s.商品名 === "TC(30分）");
  if (tc30) tc += tc30.販売商品数 * 0.5;

  const totalSalesSum = sales.reduce((a, s) => a + s.販売総売上, 0);
  const grossProfitSum = sales.reduce((a, s) => a + s.粗利総額, 0);
  const laborCost = results.reduce((a, r) => a + r.payment, 0) + 8000;
  const contributionProfit = grossProfitSum - results.reduce((a, r) => a + r.payment, 0);

  // 総労働時間
  let totalH = 0;
  let totalM = 0;
  for (const w of wages) {
    try {
      const parts = w.労働時間.split(":");
      totalH += parseInt(parts[0], 10);
      totalM += parseInt(parts[1], 10);
    } catch { /* skip */ }
  }
  totalH += Math.floor(totalM / 60);
  totalM = totalM % 60;
  const workHours = `${totalH}:${String(totalM).padStart(2, "0")}`;

  return {
    casts: results,
    tc,
    totalSales: totalSalesSum,
    grossProfit: grossProfitSum,
    laborCost,
    contributionProfit,
    workHours,
  };
}

function toNum(val: string | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}
