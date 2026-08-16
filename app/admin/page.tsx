"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";

interface Cast { id: string; castCode?: string; name: string; bio: string; imageUrl: string; storeId: string; order?: number; isPublished?: boolean; retired?: boolean; store: { name: string } | null; stores?: { id: string; name: string; slug: string; isPrimary: boolean }[]; airShiftName?: string | null; rank?: string | null; exemptFromCommuteRule?: boolean }
interface Store { id: string; slug: string; name: string }
interface Title { id: string; name: string; threshold: number; order: number }
interface Customer { id: string; email: string; emailVerified: boolean; birthdate: string | null; ageVerified: boolean; balance: number; createdAt: string; name: string | null; favoriteCast1Name: string | null; favoriteCast2Name: string | null }
interface MenuItem { id: string; imageUrl: string; alt: string; order: number }
interface ResetLog { id: string; userId: string | null; email: string | null; amount: number; idempotencyKey: string | null; createdAt: string }
interface CastRank { id: string; name: string; backRate: number; order: number }
interface CastMaster { id: string; castCode: string; name: string; rank: string; retired: boolean; tokyoAirRegi: string; tokyoAirShift: string; osakaAirRegi: string; osakaAirShift: string; nagoyaAirRegi: string; nagoyaAirShift: string; }
interface CastResult { castName: string; rank: string; basicPay: number; commute: number; grossProfit: number; totalSales: number; back: number; salary: number; payment: number }
interface SalarySummary { casts: CastResult[]; totalSalesTaxIncl: number; remoteSales: number; localSales: number; taxAmount: number; grossProfit: number; purchases: number; castPay: number; laborCost: number; contributionProfit: number; workHours: string }
interface AggResult { masterId: string; name: string; rank: string; tokyo: number; osaka: number; nagoya: number; total: number; }
interface PayMethodStat { amount: number; txCount: number; fee: number; }
interface AccountingResult {
  totalTx: number; onsiteTx: number; remoteTx: number;
  onsiteCustomers: number; onsiteSales: number; onsiteAvg: number;
  base: PayMethodStat; credit: PayMethodStat; qr: PayMethodStat;
  cash: number; totalSales: number; totalFee: number;
}
interface StoreReport { storeName: string; halves: string[]; totalSalesTaxIncl: number; remoteSales: number; localSales: number; taxAmount: number; grossProfit: number; castPay: number; laborCost: number; contributionProfit: number; }
interface SalaryPeriod { id: string; storeName: string; year: number; month: number; half: number; updatedAt: string; summaryRecord: { totalSalesTaxIncl: number; grossProfit: number; castPay: number; laborCost: number; contributionProfit: number; } | null }
// hpName は SalaryCastRecord の列名。Cast の name とは別物なので一括置換しないこと
interface HistoryCastRecord extends CastResult { hpName: string; }
interface PeriodDetail { id: string; storeName: string; year: number; month: number; half: number; castRecords: HistoryCastRecord[]; summaryRecord: SalarySummary | null }

type Tab = "cast" | "points" | "titles" | "menu" | "resets" | "salary";

const CAST_EMPTY = { name: "", bio: "", imageUrl: "", storeId: "", order: 0, isPublished: true, retired: false, twitterUrl: "", instagramUrl: "", tiktokUrl: "", airShiftName: "", rank: "", exemptFromCommuteRule: false };
const MENU_EMPTY = { imageUrl: "", alt: "", order: 0 };
const RANK_EMPTY = { name: "", backRate: 0, order: 0 };

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("cast");
  const [casts, setCasts] = useState<Cast[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [resetLogs, setResetLogs] = useState<ResetLog[]>([]);
  const [castRanks, setCastRanks] = useState<CastRank[]>([]);
  const [resetting, setResetting] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Cast form
  const [castForm, setCastForm] = useState(CAST_EMPTY);
  const [editingCast, setEditingCast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Grant form
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAmount, setGrantAmount] = useState(100);

  // Title form
  const [titleForm, setTitleForm] = useState({ name: "", threshold: 0, order: 0 });
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  // Menu form
  const [menuForm, setMenuForm] = useState(MENU_EMPTY);
  const [editingMenu, setEditingMenu] = useState<string | null>(null);
  const [uploadingMenu, setUploadingMenu] = useState(false);

  // CastRank form
  const [rankForm, setRankForm] = useState(RANK_EMPTY);
  const [editingRank, setEditingRank] = useState<string | null>(null);

  // Salary form
  const [salaryStore, setSalaryStore] = useState("東京");
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [wageFile, setWageFile] = useState<File | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [salarySummary, setSalarySummary] = useState<SalarySummary | null>(null);
  const now = new Date();
  const [salaryYear,  setSalaryYear]  = useState(now.getFullYear());
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth() + 1);
  const [salaryHalf,  setSalaryHalf]  = useState<0|1|2>(now.getDate() <= 15 ? 1 : 2);
  const [saveToDB,    setSaveToDB]    = useState(true);
  // 給与履歴
  const [salaryPeriods, setSalaryPeriods]     = useState<SalaryPeriod[]>([]);
  const [showHistory,   setShowHistory]       = useState(false);
  const [historyDetail, setHistoryDetail]     = useState<PeriodDetail | null>(null);
  const [historyMonth,  setHistoryMonth]      = useState<{year:number; month:number} | null>(null);
  // キャストマスタ 退職フィルター
  const [showRetired,   setShowRetired]       = useState(false);
  // キャストマスタ 月別ランク
  const [masterRankYear,  setMasterRankYear]  = useState(now.getFullYear());
  const [masterRankMonth, setMasterRankMonth] = useState(now.getMonth() + 1);
  const [monthlyRanks,    setMonthlyRanks]    = useState<Record<string, string>>({});

  // Salary sub-sections
  const [showRankMgmt, setShowRankMgmt]           = useState(false);
  const [showCastMasterMgmt, setShowCastMasterMgmt] = useState(false);
  const [rankCsvFile, setRankCsvFile]             = useState<File | null>(null);
  const [castMasterCsvFile, setCastMasterCsvFile] = useState<File | null>(null);
  // CastMaster
  const [castMasters, setCastMasters]             = useState<CastMaster[]>([]);
  const [masterEdits, setMasterEdits]             = useState<Record<string, Partial<CastMaster>>>({});
  // 合算給与（DBから集計）
  const [showAgg, setShowAgg]                 = useState(false);
  const [aggCalculating, setAggCalculating]   = useState(false);
  const [aggResults, setAggResults]           = useState<AggResult[] | null>(null);
  const [aggStoreReports, setAggStoreReports] = useState<StoreReport[]>([]);
  const [aggYear,  setAggYear]                = useState(now.getFullYear());
  const [aggMonth, setAggMonth]               = useState(now.getMonth() + 1);
  // 会計分析
  const [showAccounting, setShowAccounting]           = useState(false);
  const [accountingFile, setAccountingFile]           = useState<File | null>(null);
  const [accountingResult, setAccountingResult]       = useState<AccountingResult | null>(null);
  const [accountingCalculating, setAccountingCalculating] = useState(false);
  const [baseFeeRate,      setBaseFeeRate]      = useState(2.9);
  const [baseMonthlyFee,  setBaseMonthlyFee]   = useState(16580);
  const [creditFeeRate,   setCreditFeeRate]    = useState(3.24);
  const [qrFeeRate,       setQrFeeRate]        = useState(1.60);

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(""); setErr(""); }, 3000);
  };

  const fetchAll = useCallback(async () => {
    const slugs = ["tokyo", "osaka", "nagoya"];
    const [c, t, u, m, resets, ranks, masters, history, ...storeResults] = await Promise.all([
      fetch("/api/cast?includeHidden=1").then(r => r.json()),
      fetch("/api/titles").then(r => r.json()),
      fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] })),
      fetch("/api/menu").then(r => r.json()),
      fetch("/api/admin/monthly-reset").then(r => r.json()).catch(() => ({ resets: [] })),
      fetch("/api/admin/cast-ranks").then(r => r.json()).catch(() => ({ ranks: [] })),
      fetch("/api/admin/cast-master").then(r => r.json()).catch(() => ({ masters: [] })),
      fetch("/api/admin/salary/history").then(r => r.json()).catch(() => ({ periods: [] })),
      ...slugs.map(s => fetch(`/api/store/${s}`).then(r => r.json()).catch(() => ({ store: null }))),
    ]);
    setCasts(c.casts ?? []);
    setTitles(t.titles ?? []);
    setCustomers(u.users ?? []);
    setMenuItems(m.items ?? []);
    setResetLogs(resets.resets ?? []);
    setCastRanks(ranks.ranks ?? []);
    setCastMasters(masters.masters ?? []);
    setSalaryPeriods(history.periods ?? []);
    setStores(storeResults.map((r, i) => ({
      id: r.store?.id ?? "",
      slug: slugs[i],
      name: r.store?.name ?? slugs[i],
    })));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 月別ランク取得
  const fetchMonthlyRanks = useCallback(async (y: number, m: number) => {
    try {
      const res = await fetch(`/api/admin/cast-master/monthly-rank?year=${y}&month=${m}`);
      if (res.ok) {
        const d = await res.json();
        setMonthlyRanks(d.ranks ?? {});
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMonthlyRanks(masterRankYear, masterRankMonth); setMasterEdits({}); }, [masterRankYear, masterRankMonth, fetchMonthlyRanks]);

  // Cast CRUD
  const uploadImage = async (file: File) => {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const d = await res.json();
    if (res.ok) setCastForm(p => ({ ...p, imageUrl: d.url }));
    else flash(d.error ?? "アップロードエラー", true);
    setUploading(false);
  };

  const saveCast = async () => {
    if (!castForm.name.trim()) { flash("キャスト名は必須です", true); return; }
    if (!castForm.storeId) { flash("所属店舗を選択してください", true); return; }
    if (!castForm.bio.trim()) { flash("一言は必須です", true); return; }
    if (!castForm.imageUrl) { flash("キャスト画像をアップロードしてください", true); return; }

    const url = editingCast ? `/api/cast/${editingCast}` : "/api/cast";
    const method = editingCast ? "PUT" : "POST";
    const storeId = stores.find(s => s.slug === castForm.storeId || s.id === castForm.storeId)?.id || castForm.storeId;
    const payload = {
      ...castForm,
      storeId,
      twitterUrl: castForm.twitterUrl || null,
      instagramUrl: castForm.instagramUrl || null,
      tiktokUrl: castForm.tiktokUrl || null,
      airShiftName: castForm.airShiftName || null,
      rank: castForm.rank || null,
    };
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { flash("保存しました"); setCastForm(CAST_EMPTY); setEditingCast(null); fetchAll(); }
    else {
      let errMsg = `サーバーエラー (${res.status})`;
      try { const text = await res.text(); if (text) errMsg = JSON.parse(text).error ?? errMsg; } catch {}
      flash(errMsg, true);
    }
  };

  const deleteCast = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/cast/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const editCast = (cast: Cast & { twitterUrl?: string | null; instagramUrl?: string | null; tiktokUrl?: string | null }) => {
    // 掛け持ちの場合は主たる店舗をフォームに載せる
    const primary = cast.stores?.find(st => st.isPrimary) ?? cast.stores?.[0];
    const storeSlug =
      primary?.slug ?? stores.find(s => s.name === cast.store?.name)?.slug ?? "";
    setCastForm({
      name: cast.name, bio: cast.bio, imageUrl: cast.imageUrl,
      storeId: storeSlug, order: cast.order ?? 0,
      isPublished: cast.isPublished ?? true,
      retired: cast.retired ?? false,
      twitterUrl: cast.twitterUrl ?? "",
      instagramUrl: cast.instagramUrl ?? "",
      tiktokUrl: cast.tiktokUrl ?? "",
      airShiftName: cast.airShiftName ?? "",
      rank: cast.rank ?? "",
      exemptFromCommuteRule: cast.exemptFromCommuteRule ?? false,
    });
    setEditingCast(cast.id);
    setTab("cast");
  };

  // Grant
  const grantPoints = async (email: string) => {
    const res = await fetch("/api/points/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, amount: grantAmount, idempotencyKey: crypto.randomUUID() }),
    });
    const d = await res.json();
    if (res.ok) {
      flash(`${email} に ${grantAmount} pt を付与しました`);
      const u = await fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] }));
      setCustomers(u.users ?? []);
    }
    else { flash(d.error ?? "エラー", true); }
  };

  // Age verification
  const verifyAge = async (id: string, ageVerified: boolean) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageVerified }),
    });
    if (res.ok) { flash(ageVerified ? "年齢確認済みにしました" : "年齢確認を取り消しました"); fetchAll(); }
    else { flash("エラーが発生しました", true); }
  };

  // Menu CRUD
  const uploadMenuImage = async (file: File) => {
    setUploadingMenu(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload-menu", { method: "POST", body: form });
    const d = await res.json();
    if (res.ok) setMenuForm(p => ({ ...p, imageUrl: d.url }));
    else flash(d.error ?? "アップロードエラー", true);
    setUploadingMenu(false);
  };

  const saveMenuItem = async () => {
    if (!menuForm.imageUrl) { flash("画像をアップロードしてください", true); return; }
    if (!menuForm.alt.trim()) { flash("説明テキストは必須です", true); return; }
    const url = editingMenu ? `/api/menu/${editingMenu}` : "/api/menu";
    const method = editingMenu ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(menuForm) });
    if (res.ok) { flash("保存しました"); setMenuForm(MENU_EMPTY); setEditingMenu(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteMenuItem = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/menu/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Title CRUD
  const saveTitle = async () => {
    const url = editingTitle ? `/api/titles/${editingTitle}` : "/api/titles";
    const method = editingTitle ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(titleForm) });
    if (res.ok) { flash("保存しました"); setTitleForm({ name: "", threshold: 0, order: 0 }); setEditingTitle(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteTitle = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/titles/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Monthly reset
  const runMonthlyReset = async () => {
    if (!confirm("月次ポイントリセットを実行しますか？")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/admin/monthly-reset", {
        method: "POST",
        headers: { "Authorization": `Bearer ${prompt("CRON_SECRETを入力してください") ?? ""}` },
      });
      const d = await res.json();
      if (res.ok) {
        flash(`リセット完了: ${d.resetCount} 件`);
        fetchAll();
      } else {
        flash(d.error ?? "エラー", true);
      }
    } finally {
      setResetting(false);
    }
  };

  // CastRank CRUD
  const saveRank = async () => {
    if (!rankForm.name.trim()) { flash("ランク名は必須です", true); return; }
    const url = editingRank ? `/api/admin/cast-ranks/${editingRank}` : "/api/admin/cast-ranks";
    const method = editingRank ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(rankForm) });
    if (res.ok) { flash("保存しました"); setRankForm(RANK_EMPTY); setEditingRank(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const deleteRank = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/admin/cast-ranks/${id}`, { method: "DELETE" });
    fetchAll();
  };

  // Salary calculation
  const runSalaryCalc = async () => {
    if (!salesFile || !wageFile) { flash("売上CSVと人件費CSVをアップロードしてください", true); return; }
    setCalculating(true);
    setSalarySummary(null);
    try {
      const form = new FormData();
      form.append("store", salaryStore);
      form.append("salesCsv", salesFile);
      form.append("wageCsv", wageFile);
      if (saveToDB) {
        form.append("year",  String(salaryYear));
        form.append("month", String(salaryMonth));
        form.append("half",  String(salaryHalf));
      }
      const res = await fetch("/api/admin/salary", { method: "POST", body: form });
      const d = await res.json();
      if (res.ok) {
        setSalarySummary(d.summary);
        if (saveToDB && d.periodId) { flash("計算完了・DB保存しました"); fetchAll(); }
      } else { flash(d.error ?? "計算エラー", true); }
    } finally {
      setCalculating(false);
    }
  };

  const loadHistoryDetail = async (id: string) => {
    const res = await fetch(`/api/admin/salary/history/${id}`);
    const d = await res.json();
    if (res.ok) setHistoryDetail(d.period);
  };

  // DBから保存済みデータを読み込んで salarySummary にセット
  const loadSalaryFromDB = async () => {
    setCalculating(true);
    setSalarySummary(null);
    try {
      // half=0（全体）があれば優先、なければ指定halfまたは前半+後半合算
      const matchPeriod = (h: number) => salaryPeriods.some(
        p => p.storeName === salaryStore && p.year === salaryYear && p.month === salaryMonth && p.half === h
      );
      let halvesToLoad: number[];
      if (matchPeriod(0)) {
        halvesToLoad = [0]; // 全体データがあれば常にそれを使う
      } else if (salaryHalf === 0) {
        halvesToLoad = [1, 2]; // 全体指定だが全体データなし→前半+後半を合算
      } else {
        halvesToLoad = [salaryHalf];
      }
      const periods: PeriodDetail[] = [];
      for (const h of halvesToLoad) {
        const existing = salaryPeriods.find(
          p => p.storeName === salaryStore && p.year === salaryYear && p.month === salaryMonth && p.half === h
        );
        if (!existing) {
          flash(`${salaryStore} ${salaryYear}/${String(salaryMonth).padStart(2,"0")} ${halfLabel(h)} のデータがDBにありません`, true);
          return;
        }
        const res = await fetch(`/api/admin/salary/history/${existing.id}`);
        const d = await res.json();
        if (!res.ok) { flash(d.error ?? "読込エラー", true); return; }
        periods.push(d.period);
      }
      // PeriodDetail を SalarySummary 形式に変換
      const castMap = new Map<string, CastResult>();
      for (const p of periods) {
        for (const c of p.castRecords) {
          const key = c.castName;
          const existing = castMap.get(key);
          if (existing) {
            existing.basicPay += c.basicPay;
            existing.commute += c.commute;
            existing.back += c.back;
            existing.payment += c.payment;
            existing.grossProfit += c.grossProfit;
            existing.totalSales += c.totalSales;
          } else {
            castMap.set(key, {
              castName: c.castName,
              rank: c.rank,
              basicPay: c.basicPay,
              commute: c.commute,
              back: c.back,
              salary: c.basicPay + c.commute,
              payment: c.payment,
              grossProfit: c.grossProfit,
              totalSales: c.totalSales,
            });
          }
        }
      }
      const summaries = periods.map(p => p.summaryRecord).filter(Boolean) as SalarySummary[];
      const summary: SalarySummary = {
        casts: [...castMap.values()],
        totalSalesTaxIncl: summaries.reduce((a, s) => a + s.totalSalesTaxIncl, 0),
        remoteSales: summaries.reduce((a, s) => a + s.remoteSales, 0),
        localSales: summaries.reduce((a, s) => a + s.localSales, 0),
        taxAmount: summaries.reduce((a, s) => a + s.taxAmount, 0),
        grossProfit: summaries.reduce((a, s) => a + s.grossProfit, 0),
        purchases: summaries.reduce((a, s) => a + (s.purchases ?? 0), 0),
        castPay: summaries.reduce((a, s) => a + s.castPay, 0),
        laborCost: summaries.reduce((a, s) => a + s.laborCost, 0),
        contributionProfit: summaries.reduce((a, s) => a + s.contributionProfit, 0),
        workHours: summaries.map(s => s.workHours).join(" + "),
      };
      setSalarySummary(summary);
      flash("DBから読み込みました");
    } finally {
      setCalculating(false);
    }
  };

  // 選択中の店舗+期間にDB保存データがあるか（全体データがあれば前半/後半選択でもOK）
  const hasDBData = salaryPeriods.some(p => {
    if (p.storeName !== salaryStore || p.year !== salaryYear || p.month !== salaryMonth) return false;
    if (salaryHalf === 0) return true;
    return p.half === salaryHalf || p.half === 0;
  });

  const deleteHistoryPeriod = async (id: string) => {
    if (!confirm("この期間の給与データを削除しますか？")) return;
    await fetch(`/api/admin/salary/history?id=${id}`, { method: "DELETE" });
    setHistoryDetail(null);
    fetchAll();
  };

  // CSVファイル読み込み: UTF-8(BOM付き含む) / Shift-JIS を自動判定
  const readCsvFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const buf = e.target?.result as ArrayBuffer;
        // UTF-8 BOM チェック
        const bytes = new Uint8Array(buf);
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
          resolve(new TextDecoder("utf-8").decode(buf).replace(/^\uFEFF/, ""));
        } else {
          // Shift-JIS を試みる（失敗したら UTF-8 で再試行）
          try {
            const sjis = new TextDecoder("shift-jis").decode(buf);
            // 日本語が正常に含まれているか簡易チェック（ゲタ文字が多い場合はUTF-8）
            const geta = (sjis.match(/\uFFFD/g) ?? []).length;
            resolve(geta > 3 ? new TextDecoder("utf-8").decode(buf) : sjis);
          } catch {
            resolve(new TextDecoder("utf-8").decode(buf));
          }
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const parseCsv = (text: string) => {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { header: [], rows: [] as Record<string, string>[] };
    const header = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const cells = line.split(",");
      const row: Record<string, string> = {};
      header.forEach((h, i) => { row[h] = (cells[i] ?? "").trim(); });
      return row;
    });
    return { header, rows };
  };

  const importRanksCsv = async () => {
    if (!rankCsvFile) return;
    const text = await readCsvFile(rankCsvFile);
    const { rows } = parseCsv(text);
    const ranks = rows
      .filter(r => r["ランク名"] || r["ランク"])
      .map((r, i) => ({
        name: r["ランク名"] || r["ランク"] || "",
        backRate: (() => { const v = Number(r["バック率"] ?? "0"); return v > 1 ? v / 100 : v; })(),
        order: i,
      }));
    if (ranks.length === 0) { flash("CSVにデータがありません（ヘッダー: ランク,バック率）", true); return; }
    const res = await fetch("/api/admin/cast-ranks/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranks }),
    });
    if (res.ok) { flash(`${ranks.length}件のランクを登録しました`); setRankCsvFile(null); fetchAll(); }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };


  // CSVダウンロード (UTF-8 BOM付き → Excel対応)
  const downloadCsv = (filename: string, rows: string[][]) => {
    const bom = "\uFEFF";
    const content = bom + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRanksCsv = () => {
    const rows = [["ランク", "バック率"], ...castRanks.map(r => [r.name, String((r.backRate * 100).toFixed(0))])];
    downloadCsv("キャストランク.csv", rows);
  };

  const importCastMasterNewCsv = async () => {
    if (!castMasterCsvFile) return;
    const text = await readCsvFile(castMasterCsvFile);
    const { rows } = parseCsv(text);
    // 列が無い場合は undefined のまま送る（サーバー側で「変更しない」と解釈される）
    const mapped = rows.map(r => ({
      castCode:       r["キャストコード"],
      name:           r["HP名"],
      rank:           r["ランク"],
      retired:        r["退職"] === undefined ? undefined : ["1", "true", "TRUE", "はい", "○"].includes(r["退職"]),
      tokyoAirRegi:   r["東京エアレジ"],
      tokyoAirShift:  r["東京エアシフト"],
      osakaAirRegi:   r["大阪エアレジ"],
      osakaAirShift:  r["大阪エアシフト"],
      nagoyaAirRegi:  r["名古屋エアレジ"],
      nagoyaAirShift: r["名古屋エアシフト"],
    })).filter(m => [m.castCode, m.name, m.tokyoAirRegi, m.osakaAirRegi, m.nagoyaAirRegi].some(v => v));
    if (mapped.length === 0) { flash("CSVにデータがありません（ヘッダー: キャストコード,HP名,東京エアレジ,…）", true); return; }
    const res = await fetch("/api/admin/cast-master/bulk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masters: mapped }),
    });
    if (res.ok) {
      const d = await res.json();
      const retired: { castCode: string; name: string }[] = d.retiredCasts ?? [];
      let msg = `新規${d.created}件 / 更新${d.updated}件`;
      if (retired.length > 0)
        msg += ` / CSVに無い${retired.length}件を退職扱いにしました（${retired.map(c => c.name || c.castCode).join("、")}）`;
      flash(msg);
      setCastMasterCsvFile(null); fetchAll();
    }
    else { const d = await res.json(); flash(d.error ?? "エラー", true); }
  };

  const downloadCastMasterNewCsv = () => {
    const header = ["キャストコード", "HP名", "東京エアレジ", "東京エアシフト", "大阪エアレジ", "大阪エアシフト", "名古屋エアレジ", "名古屋エアシフト", "ランク", "退職"];
    const rows = [header, ...castMasters.map(m => [m.castCode, m.name, m.tokyoAirRegi, m.tokyoAirShift, m.osakaAirRegi, m.osakaAirShift, m.nagoyaAirRegi, m.nagoyaAirShift, m.rank, m.retired ? "1" : ""])];
    downloadCsv("キャストマスタ.csv", rows);
  };

  const saveCastMaster = async (id: string) => {
    const edit = masterEdits[id];
    if (!edit) return;
    // ランク以外のフィールドは CastMaster に直接保存
    const { rank: editRank, ...otherFields } = edit;
    const hasOtherFields = Object.keys(otherFields).length > 0;
    const hasRank = editRank !== undefined;

    const promises: Promise<Response>[] = [];
    // CastMaster の他フィールドを更新
    if (hasOtherFields) {
      promises.push(fetch(`/api/admin/cast-master/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(otherFields),
      }));
    }
    // ランクは月別ランクとして保存（CastMaster.rank も同時に更新される）
    if (hasRank) {
      promises.push(fetch("/api/admin/cast-master/monthly-rank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: masterRankYear, month: masterRankMonth,
          ranks: [{ castMasterId: id, rank: editRank }],
        }),
      }));
    }
    const results = await Promise.all(promises);
    if (results.every(r => r.ok)) {
      flash(`${masterRankYear}年${masterRankMonth}月のランクとして保存しました`);
      setMasterEdits(p => { const n = { ...p }; delete n[id]; return n; });
      fetchAll();
      fetchMonthlyRanks(masterRankYear, masterRankMonth);
    } else {
      flash("保存エラー", true);
    }
  };

  const deleteCastMaster = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/admin/cast-master/${id}`, { method: "DELETE" });
    fetchAll();
  };

  const halfLabel = (half: number) => half === 0 ? "全体" : half === 1 ? "前半" : "後半";

  // CSVファイル名から取得期間を自動検出: "_YYYYMMDD-YYYYMMDD" パターン
  const detectPeriodFromFilename = (filename: string): { year: number; month: number; half: 0|1|2 } | null => {
    const m = filename.match(/(\d{8})-(\d{8})/);
    if (!m) return null;
    const start = m[1]!;
    const end = m[2]!;
    const year = parseInt(start.slice(0, 4), 10);
    const month = parseInt(start.slice(4, 6), 10);
    const startDay = parseInt(start.slice(6, 8), 10);
    const endDay = parseInt(end.slice(6, 8), 10);
    let half: 0|1|2;
    if (startDay === 1 && endDay >= 28) half = 0;      // 全体（1ヶ月）
    else if (startDay <= 15 && endDay <= 15) half = 1; // 前半
    else half = 2;                                      // 後半
    return { year, month, half };
  };

  const runAccountingAnalysis = async () => {
    if (!accountingFile) return;
    setAccountingCalculating(true);
    setAccountingResult(null);
    try {
      const text = await readCsvFile(accountingFile);
      const { rows } = parseCsv(text);

      // 取引Noでグループ化（来店日がある行 = ヘッダー行）
      const txGroups = new Map<string, Record<string, string>[]>();
      for (const row of rows) {
        const no = row["取引No"];
        if (!no) continue;
        if (!txGroups.has(no)) txGroups.set(no, []);
        txGroups.get(no)!.push(row);
      }

      let totalTx = 0, onsiteTx = 0, remoteTx = 0;
      let onsiteCustomers = 0, onsiteSales = 0;
      let baseAmt = 0, baseTxCount = 0;
      let creditAmt = 0, creditTxCount = 0;
      let qrAmt = 0, qrTxCount = 0;
      let cashTotal = 0, totalSales = 0;

      for (const groupRows of txGroups.values()) {
        const header = groupRows.find(r => r["来店日"]) ?? groupRows[0];
        if (!header) continue;
        totalTx++;

        const total = parseInt(header["修正後合計"] || header["合計"] || "0", 10);
        totalSales += total;

        // 遠隔判定：いずれかの行のカテゴリーが遠隔_ で始まる
        const isRemote = groupRows.some(r => (r["カテゴリー名"] ?? "").startsWith("遠隔"));

        if (!isRemote) {
          onsiteTx++;
          onsiteSales += total;
          onsiteCustomers += Math.max(parseInt(header["人数"] || "1", 10), 1);
        } else {
          remoteTx++;
        }

        const base   = parseInt(header["BASE"] || "0", 10);
        const credit = parseInt(header["クレジットカード(Airペイ)"] || "0", 10);
        const qr     = parseInt(header["QR決済(Airペイ QR)"] || "0", 10)
                     + parseInt(header["PayPay送金"] || "0", 10);
        const cash   = parseInt(header["現金"] || "0", 10);

        if (base   > 0) { baseAmt   += base;   baseTxCount++;   }
        if (credit > 0) { creditAmt += credit; creditTxCount++; }
        if (qr     > 0) { qrAmt     += qr;     qrTxCount++;     }
        cashTotal += cash;
      }

      // 手数料計算（BASEグロースプランはサービス利用料¥0、決済手数料のみ）
      const baseFee   = Math.round(baseAmt * (baseFeeRate / 100)) + baseMonthlyFee;
      const creditFee = Math.round(creditAmt * (creditFeeRate / 100));
      const qrFee     = Math.round(qrAmt     * (qrFeeRate     / 100));

      setAccountingResult({
        totalTx, onsiteTx, remoteTx,
        onsiteCustomers, onsiteSales,
        onsiteAvg: onsiteCustomers > 0 ? Math.round(onsiteSales / onsiteCustomers) : 0,
        base:   { amount: baseAmt,   txCount: baseTxCount,   fee: baseFee },
        credit: { amount: creditAmt, txCount: creditTxCount, fee: creditFee },
        qr:     { amount: qrAmt,     txCount: qrTxCount,     fee: qrFee },
        cash: cashTotal, totalSales,
        totalFee: baseFee + creditFee + qrFee,
      });
    } finally {
      setAccountingCalculating(false);
    }
  };

  const runAggCalc = async () => {
    setAggCalculating(true);
    setAggResults(null);
    setAggStoreReports([]);
    try {
      const res = await fetch(`/api/admin/salary/aggregate-db?year=${aggYear}&month=${aggMonth}`);
      const d = await res.json();
      if (res.ok) { setAggResults(d.results); setAggStoreReports(d.storeReports ?? []); }
      else flash(d.error ?? "集計エラー", true);
    } finally { setAggCalculating(false); }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "cast",       label: "🐺 キャスト" },
    { key: "salary",     label: "💴 給与計算" },
    { key: "points",     label: "⭐ ポイント付与" },
    { key: "titles",     label: "🏆 称号マスタ" },
    { key: "menu",       label: "🍽️ メニュー" },
    { key: "resets",     label: "🔄 リセット履歴" },
  ];

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-black gradient-text text-neon-glow text-center">
          ⚙️ 管理画面
        </h1>

        {msg && <div className="glass p-4 text-green-400 text-center">{msg}</div>}
        {err && <div className="glass p-4 text-neon-pink text-center">{err}</div>}

        {/* タブ */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                tab === key ? "bg-neon-violet text-white" : "glass text-white/60 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
          <Link href="/me" className="ml-auto text-white/40 hover:text-white/70 text-sm self-center">
            マイページ →
          </Link>
        </div>

        {/* キャスト管理 */}
        {tab === "cast" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingCast ? "キャスト編集" : "キャスト追加"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">名前 <span className="text-neon-pink">*</span></label>
                  <input className="input-field" value={castForm.name} onChange={e => setCastForm(p => ({ ...p, name: e.target.value }))} placeholder="キャスト名" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">所属店舗 <span className="text-neon-pink">*</span></label>
                  <select className="input-field" value={castForm.storeId} onChange={e => setCastForm(p => ({ ...p, storeId: e.target.value }))}>
                    <option value="">選択してください</option>
                    {stores.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60 block mb-1">一言 <span className="text-neon-pink">*</span></label>
                  <textarea className="input-field min-h-[80px]" value={castForm.bio} onChange={e => setCastForm(p => ({ ...p, bio: e.target.value }))} placeholder="一言を入力（例：みんなを笑顔にします！）" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/60 block mb-1">キャスト画像 <span className="text-neon-pink">*</span></label>
                  <div className="flex gap-3 items-start">
                    {castForm.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={castForm.imageUrl} alt="プレビュー" className="w-16 h-20 object-cover rounded-lg border border-white/20 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed cursor-pointer transition-all ${uploading ? "border-white/20 text-white/30" : "border-neon-violet text-neon-violet hover:bg-neon-violet/10"}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-sm">{uploading ? "アップロード中..." : "画像を選択"}</span>
                        <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                      </label>
                      <input className="input-field text-xs" value={castForm.imageUrl} onChange={e => setCastForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="または画像URLを直接入力" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={castForm.order} onChange={e => setCastForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">X (Twitter) URL</label>
                  <input className="input-field" value={castForm.twitterUrl} onChange={e => setCastForm(p => ({ ...p, twitterUrl: e.target.value }))} placeholder="https://x.com/@..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">Instagram URL</label>
                  <input className="input-field" value={castForm.instagramUrl} onChange={e => setCastForm(p => ({ ...p, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">TikTok URL</label>
                  <input className="input-field" value={castForm.tiktokUrl} onChange={e => setCastForm(p => ({ ...p, tiktokUrl: e.target.value }))} placeholder="https://tiktok.com/@..." />
                </div>
                {/* 給与計算用フィールド */}
                <div>
                  <label className="text-xs text-white/60 block mb-1">AirShift氏名（給与計算用）</label>
                  <input className="input-field" value={castForm.airShiftName} onChange={e => setCastForm(p => ({ ...p, airShiftName: e.target.value }))} placeholder="勤怠CSVの氏名と一致させてください" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">ランク</label>
                  <select className="input-field" value={castForm.rank} onChange={e => setCastForm(p => ({ ...p, rank: e.target.value }))}>
                    <option value="">未設定</option>
                    {castRanks.map(r => <option key={r.id} value={r.name}>{r.name}（バック率 {(r.backRate * 100).toFixed(0)}%）</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={castForm.isPublished}
                    onChange={e => setCastForm(p => ({ ...p, isPublished: e.target.checked }))}
                    className="w-4 h-4 accent-neon-violet"
                  />
                  <label htmlFor="isPublished" className="text-xs text-white/60 cursor-pointer">
                    HPに表示する（オフにするとトップ・キャスト一覧・店舗ページ・ランキング・ギフト送付先・推し選択のすべてから非表示になります）
                  </label>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="retired"
                    checked={castForm.retired}
                    onChange={e => setCastForm(p => ({ ...p, retired: e.target.checked }))}
                    className="w-4 h-4 accent-neon-violet"
                  />
                  <label htmlFor="retired" className="text-xs text-white/60 cursor-pointer">
                    退職（給与集計の対象から外れます。HPにも表示されません）
                  </label>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="exemptFromCommuteRule"
                    checked={castForm.exemptFromCommuteRule}
                    onChange={e => setCastForm(p => ({ ...p, exemptFromCommuteRule: e.target.checked }))}
                    className="w-4 h-4 accent-neon-violet"
                  />
                  <label htmlFor="exemptFromCommuteRule" className="text-xs text-white/60 cursor-pointer">
                    通勤手当0ルール除外（ゴールド以上でも通勤手当を支給する）
                  </label>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveCast} disabled={uploading} className="btn-primary text-sm">{editingCast ? "更新" : "追加"}</button>
                {editingCast && <button onClick={() => { setEditingCast(null); setCastForm(CAST_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            <div className="space-y-2">
              {casts.map(cast => (
                <div key={cast.id} className="glass-dark p-3 flex items-center gap-4">
                  {cast.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cast.imageUrl}
                      alt={cast.name}
                      className="w-12 h-14 object-cover rounded-lg flex-shrink-0 bg-white/5"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-12 h-14 rounded-lg flex-shrink-0 bg-gradient-to-br from-neon-violet to-neon-purple flex items-center justify-center text-xl">🐺</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate flex items-center gap-2">
                      {cast.name}
                      {cast.isPublished === false && (
                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex-shrink-0">HP非表示</span>
                      )}
                      {cast.retired && (
                        <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex-shrink-0">退職</span>
                      )}
                    </div>
                    <div className="text-xs text-white/40">
                      {cast.castCode && <span className="font-mono mr-2">{cast.castCode}</span>}
                      {/* 掛け持ちは所属する全店舗を出す。( ) 付きが主たる店舗以外 */}
                      {cast.stores && cast.stores.length > 0
                        ? cast.stores.map(st => (st.isPrimary ? st.name : `（${st.name}）`)).join(" ")
                        : (cast.store?.name ?? "")}
                      {cast.rank ? ` · ${cast.rank}` : ""}
                    </div>
                  </div>
                  <button onClick={() => editCast(cast)} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                  <button onClick={() => deleteCast(cast.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                </div>
              ))}
            </div>

            {/* 給与用の名寄せ設定（エアレジ・エアシフト名） */}
            <div className="glass p-4">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowCastMasterMgmt(p => !p)}
              >
                <span className="font-bold text-star-300">📋 エアレジ・エアシフト名の対応（給与計算用）</span>
                <span className="text-white/40 text-sm">{showCastMasterMgmt ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showCastMasterMgmt && (
                <div className="mt-4 space-y-4">
                  {/* CSV インポート / ダウンロード */}
                  <div className="glass-dark p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/50">CSVインポート（ヘッダー: <code>HP名,東京エアレジ,東京エアシフト,大阪エアレジ,大阪エアシフト,名古屋エアレジ,名古屋エアシフト,ランク</code>）</p>
                      <button onClick={downloadCastMasterNewCsv} className="text-xs text-neon-violet hover:text-neon-purple whitespace-nowrap">⬇ CSVダウンロード</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file" accept=".csv"
                        className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer flex-1"
                        onChange={e => setCastMasterCsvFile(e.target.files?.[0] ?? null)}
                      />
                      <button onClick={importCastMasterNewCsv} disabled={!castMasterCsvFile} className="btn-primary text-sm whitespace-nowrap">インポート</button>
                    </div>
                  </div>
                  {/* 退職フィルター & 月別ランク年月セレクター */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                      <input type="checkbox" checked={showRetired} onChange={e => setShowRetired(e.target.checked)} className="accent-neon-violet" />
                      退職したキャストを表示
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/60">ランク対象月:</span>
                      <select className="input-field py-0.5 px-1 text-xs w-20"
                        value={masterRankYear}
                        onChange={e => setMasterRankYear(Number(e.target.value))}
                      >
                        {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                          <option key={y} value={y}>{y}年</option>
                        ))}
                      </select>
                      <select className="input-field py-0.5 px-1 text-xs w-16"
                        value={masterRankMonth}
                        onChange={e => setMasterRankMonth(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m}>{m}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {/* マスタ一覧 (inline edit) */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[1030px]">
                      <thead>
                        <tr className="text-white/50 border-b border-white/10">
                          <th className="text-left pb-2 pr-2">コード</th>
                          <th className="text-left pb-2 pr-2">HP名</th>
                          <th className="text-left pb-2 pr-2">東京<br/>エアレジ</th>
                          <th className="text-left pb-2 pr-2">東京<br/>エアシフト</th>
                          <th className="text-left pb-2 pr-2">大阪<br/>エアレジ</th>
                          <th className="text-left pb-2 pr-2">大阪<br/>エアシフト</th>
                          <th className="text-left pb-2 pr-2">名古屋<br/>エアレジ</th>
                          <th className="text-left pb-2 pr-2">名古屋<br/>エアシフト</th>
                          <th className="text-left pb-2 pr-2">ランク</th>
                          <th className="text-left pb-2 pr-2">退職</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {castMasters.filter(m => showRetired || !m.retired).map(m => {
                          const monthlyRank = monthlyRanks[m.id] ?? m.rank;
                          const mWithMonthlyRank = { ...m, rank: monthlyRank };
                          const e = masterEdits[m.id] ?? mWithMonthlyRank;
                          const changed = masterEdits[m.id] != null;
                          const field = (key: keyof CastMaster, w = "w-20") => (
                            <input className={`input-field py-0.5 px-1 text-xs ${w}`}
                              value={String(e[key] ?? "")}
                              onChange={ev => setMasterEdits(p => ({ ...p, [m.id]: { ...(p[m.id] ?? mWithMonthlyRank), [key]: ev.target.value } }))}
                            />
                          );
                          return (
                            <tr key={m.id} className={`border-b border-white/5 ${m.retired ? "opacity-40" : ""} ${changed ? "bg-neon-violet/5" : ""}`}>
                              {/* castCode は外部システムが参照する不変コードなので編集させない */}
                              <td className="py-1 pr-2 font-mono text-white/40 whitespace-nowrap">{m.castCode}</td>
                              <td className="py-1 pr-2">{field("name")}</td>
                              <td className="py-1 pr-2">{field("tokyoAirRegi")}</td>
                              <td className="py-1 pr-2">{field("tokyoAirShift")}</td>
                              <td className="py-1 pr-2">{field("osakaAirRegi")}</td>
                              <td className="py-1 pr-2">{field("osakaAirShift")}</td>
                              <td className="py-1 pr-2">{field("nagoyaAirRegi")}</td>
                              <td className="py-1 pr-2">{field("nagoyaAirShift")}</td>
                              <td className="py-1 pr-2">
                                <select className="input-field py-0.5 px-1 text-xs w-20"
                                  value={String(e.rank ?? "")}
                                  onChange={ev => setMasterEdits(p => ({ ...p, [m.id]: { ...(p[m.id] ?? mWithMonthlyRank), rank: ev.target.value } }))}
                                >
                                  <option value="">--</option>
                                  {castRanks.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                </select>
                              </td>
                              <td className="py-1 pr-2">
                                <input type="checkbox"
                                  checked={Boolean(e.retired)}
                                  onChange={ev => setMasterEdits(p => ({ ...p, [m.id]: { ...(p[m.id] ?? mWithMonthlyRank), retired: ev.target.checked } }))}
                                  className="accent-neon-pink"
                                />
                              </td>
                              <td className="py-1 flex gap-2">
                                {changed && <button onClick={() => saveCastMaster(m.id)} className="text-neon-violet hover:text-neon-purple">{masterRankYear}年{masterRankMonth}月のランクとして保存</button>}
                                <button onClick={() => deleteCastMaster(m.id)} className="text-neon-pink hover:text-red-400">削除</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {castMasters.length === 0 && <p className="text-white/40 text-sm text-center py-4">マスタが登録されていません。CSVからインポートしてください。</p>}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* 給与計算 */}
        {tab === "salary" && (
          <div className="space-y-6">

            {/* キャストランク管理 */}
            <div className="glass p-4">
              <button
                className="w-full flex items-center justify-between text-left"
                onClick={() => setShowRankMgmt(p => !p)}
              >
                <span className="font-bold text-star-300">🏅 キャストランク管理</span>
                <span className="text-white/40 text-sm">{showRankMgmt ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showRankMgmt && (
                <div className="mt-4 space-y-4">
                  {/* CSV インポート / ダウンロード */}
                  <div className="glass-dark p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-white/50">CSVインポート（ヘッダー: <code>ランク,バック率</code>、バック率は%で入力）</p>
                      <button onClick={downloadRanksCsv} className="text-xs text-neon-violet hover:text-neon-purple whitespace-nowrap">⬇ CSVダウンロード</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="file" accept=".csv"
                        className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer flex-1"
                        onChange={e => setRankCsvFile(e.target.files?.[0] ?? null)}
                      />
                      <button onClick={importRanksCsv} disabled={!rankCsvFile} className="btn-primary text-sm whitespace-nowrap">インポート</button>
                    </div>
                  </div>
                  {/* 手動追加フォーム */}
                  <div className="space-y-3">
                    <p className="text-xs text-white/50 font-bold">{editingRank ? "ランク編集" : "手動追加"}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-white/60 block mb-1">ランク名 <span className="text-neon-pink">*</span></label>
                        <input className="input-field" value={rankForm.name} onChange={e => setRankForm(p => ({ ...p, name: e.target.value }))} placeholder="例: ゴールド" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">バック率（%） <span className="text-neon-pink">*</span></label>
                        <input type="number" className="input-field" value={Math.round(rankForm.backRate * 100)} onChange={e => setRankForm(p => ({ ...p, backRate: Number(e.target.value) / 100 }))} min={0} max={100} step={1} placeholder="例: 50" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">表示順</label>
                        <input type="number" className="input-field" value={rankForm.order} onChange={e => setRankForm(p => ({ ...p, order: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={saveRank} className="btn-primary text-sm">{editingRank ? "更新" : "追加"}</button>
                      {editingRank && <button onClick={() => { setEditingRank(null); setRankForm(RANK_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
                    </div>
                  </div>
                  {/* 一覧 */}
                  <div className="space-y-2">
                    {castRanks.map(r => (
                      <div key={r.id} className="glass-dark p-3 flex items-center gap-4">
                        <div className="flex-1">
                          <span className="font-bold text-white">{r.name}</span>
                          <span className="text-xs text-white/40 ml-3">バック率: {(r.backRate * 100).toFixed(0)}%　順番: {r.order}</span>
                        </div>
                        <button onClick={() => { setRankForm({ name: r.name, backRate: r.backRate, order: r.order }); setEditingRank(r.id); }} className="text-neon-violet text-sm hover:text-neon-purple">編集</button>
                        <button onClick={() => deleteRank(r.id)} className="text-neon-pink text-sm hover:text-red-400">削除</button>
                      </div>
                    ))}
                    {castRanks.length === 0 && <p className="text-white/40 text-sm text-center py-4">ランクが登録されていません</p>}
                  </div>
                </div>
              )}
            </div>

            {/* 給与計算フォーム */}
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">給与計算</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">店舗</label>
                  <select className="input-field" value={salaryStore} onChange={e => setSalaryStore(e.target.value)}>
                    {[{ value: "東京", label: "東京" }, { value: "大阪", label: "大阪" }, { value: "名古屋", label: "名古屋" }].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">年</label>
                  <input type="number" className="input-field" value={salaryYear} onChange={e => setSalaryYear(Number(e.target.value))} min={2020} max={2099} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">月</label>
                  <input type="number" className="input-field" value={salaryMonth} onChange={e => setSalaryMonth(Number(e.target.value))} min={1} max={12} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">前半/後半</label>
                  <select className="input-field" value={salaryHalf} onChange={e => setSalaryHalf(Number(e.target.value) as 0|1|2)}>
                    <option value={0}>全体（1ヶ月）</option>
                    <option value={1}>前半 (1〜15日)</option>
                    <option value={2}>後半 (16日〜末)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">売上CSV（Shift-JIS）<span className="text-neon-pink"> *</span></label>
                  <input type="file" accept=".csv"
                    className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      setSalesFile(f);
                      if (f) {
                        const d = detectPeriodFromFilename(f.name);
                        if (d) { setSalaryYear(d.year); setSalaryMonth(d.month); setSalaryHalf(d.half); }
                      }
                    }} />
                  {salesFile && <p className="text-xs text-white/40 mt-1">{salesFile.name}</p>}
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">人件費CSV（UTF-8）<span className="text-neon-pink"> *</span></label>
                  <input type="file" accept=".csv"
                    className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer"
                    onChange={e => setWageFile(e.target.files?.[0] ?? null)} />
                  {wageFile && <p className="text-xs text-white/40 mt-1">{wageFile.name}</p>}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={saveToDB} onChange={e => setSaveToDB(e.target.checked)} className="accent-neon-violet" />
                計算結果をDBに保存（{salaryYear}/{String(salaryMonth).padStart(2,"0")} {halfLabel(salaryHalf)}）
              </label>
              <div className="flex gap-3 items-center flex-wrap">
                <button onClick={runSalaryCalc} disabled={calculating || !salesFile || !wageFile} className="btn-primary">
                  {calculating ? "計算中..." : "計算実行"}
                </button>
                <button onClick={loadSalaryFromDB} disabled={calculating || !hasDBData} className="btn-primary bg-white/10 hover:bg-white/20">
                  {calculating ? "読込中..." : "DBから読込"}
                </button>
                {hasDBData && !salesFile && !wageFile && (
                  <span className="text-xs text-star-300">DB保存データあり</span>
                )}
              </div>
            </div>

            {/* 合算給与（DBから集計） */}
            <div className="glass p-4">
              <button className="w-full flex items-center justify-between text-left" onClick={() => setShowAgg(p => !p)}>
                <span className="font-bold text-star-300">📊 全店舗合算給与</span>
                <span className="text-white/40 text-sm">{showAgg ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showAgg && (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-3 items-end flex-wrap">
                    <div>
                      <label className="text-xs text-white/60 block mb-1">年</label>
                      <input type="number" className="input-field w-24" value={aggYear} onChange={e => setAggYear(Number(e.target.value))} min={2020} max={2099} />
                    </div>
                    <div>
                      <label className="text-xs text-white/60 block mb-1">月</label>
                      <input type="number" className="input-field w-20" value={aggMonth} onChange={e => setAggMonth(Number(e.target.value))} min={1} max={12} />
                    </div>
                    <button onClick={runAggCalc} disabled={aggCalculating} className="btn-primary">
                      {aggCalculating ? "集計中..." : "DBから集計"}
                    </button>
                  </div>
                  {/* 店舗別P&L */}
                  {aggStoreReports.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-white/40">店舗別サマリー（{aggStoreReports.map(r => `${r.storeName} ${r.halves.join("+")}`).join(" / ")}）</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[600px]">
                          <thead>
                            <tr className="text-white/40 border-b border-white/10">
                              <th className="text-left pb-1">店舗</th>
                              <th className="text-right pb-1">売上(税込)</th>
                              <th className="text-right pb-1">売上総利益</th>
                              <th className="text-right pb-1">人件費</th>
                              <th className="text-right pb-1 text-star-300">貢献利益</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aggStoreReports.map(r => (
                              <tr key={r.storeName} className="border-b border-white/5">
                                <td className="py-1.5 text-white/80">{r.storeName}</td>
                                <td className="text-right text-white/70">¥{Math.round(r.totalSalesTaxIncl).toLocaleString()}</td>
                                <td className="text-right text-white/70">¥{Math.round(r.grossProfit).toLocaleString()}</td>
                                <td className="text-right text-white/70">¥{Math.round(r.laborCost).toLocaleString()}</td>
                                <td className={`text-right font-bold ${r.contributionProfit >= 0 ? "text-star-300" : "text-neon-pink"}`}>
                                  ¥{Math.round(r.contributionProfit).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            {aggStoreReports.length > 1 && (() => {
                              const tot = aggStoreReports.reduce((a, r) => ({
                                totalSalesTaxIncl: a.totalSalesTaxIncl + r.totalSalesTaxIncl,
                                grossProfit: a.grossProfit + r.grossProfit,
                                laborCost: a.laborCost + r.laborCost,
                                contributionProfit: a.contributionProfit + r.contributionProfit,
                              }), { totalSalesTaxIncl: 0, grossProfit: 0, laborCost: 0, contributionProfit: 0 });
                              return (
                                <tr className="border-t border-white/20 font-bold">
                                  <td className="pt-1.5 text-white">合計</td>
                                  <td className="text-right pt-1.5 text-white">¥{Math.round(tot.totalSalesTaxIncl).toLocaleString()}</td>
                                  <td className="text-right pt-1.5 text-white">¥{Math.round(tot.grossProfit).toLocaleString()}</td>
                                  <td className="text-right pt-1.5 text-white">¥{Math.round(tot.laborCost).toLocaleString()}</td>
                                  <td className={`text-right pt-1.5 ${tot.contributionProfit >= 0 ? "text-star-300" : "text-neon-pink"}`}>¥{Math.round(tot.contributionProfit).toLocaleString()}</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* キャスト別合算 */}
                  {aggResults && aggResults.length > 0 && (
                    <div className="overflow-x-auto">
                      <p className="text-xs text-white/40 mb-2">キャスト別給与合算</p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white/50 text-xs border-b border-white/10">
                            <th className="text-left pb-2">キャスト</th>
                            <th className="text-right pb-2">東京</th>
                            <th className="text-right pb-2">大阪</th>
                            <th className="text-right pb-2">名古屋</th>
                            <th className="text-right pb-2 font-bold text-star-300">合計</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggResults.map(r => (
                            <tr key={r.masterId} className="border-b border-white/5">
                              <td className="py-2">
                                <div className="font-medium text-white">{r.name || "—"}</div>
                                <div className="text-xs text-white/40">{r.rank}</div>
                              </td>
                              <td className="text-right text-white/70">{r.tokyo > 0 ? `¥${r.tokyo.toLocaleString()}` : "—"}</td>
                              <td className="text-right text-white/70">{r.osaka > 0 ? `¥${r.osaka.toLocaleString()}` : "—"}</td>
                              <td className="text-right text-white/70">{r.nagoya > 0 ? `¥${r.nagoya.toLocaleString()}` : "—"}</td>
                              <td className="text-right font-bold text-star-300">¥{r.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-white/20">
                            <td className="pt-2 font-bold text-white" colSpan={4}>合計</td>
                            <td className="pt-2 text-right font-bold text-neon-violet">¥{aggResults.reduce((a, r) => a + r.total, 0).toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  {aggResults && aggResults.length === 0 && <p className="text-white/40 text-sm text-center py-4">該当月の給与データがDBにありません</p>}
                </div>
              )}
            </div>

            {/* 会計分析 */}
            <div className="glass p-4">
              <button className="w-full flex items-center justify-between text-left" onClick={() => setShowAccounting(p => !p)}>
                <span className="font-bold text-star-300">🧾 会計分析</span>
                <span className="text-white/40 text-sm">{showAccounting ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showAccounting && (
                <div className="mt-4 space-y-4">
                  {/* ファイル選択 */}
                  <div className="glass-dark p-4 space-y-3">
                    <div>
                      <label className="text-xs text-white/60 block mb-1">会計明細CSV（Shift-JIS）<span className="text-neon-pink"> *</span></label>
                      <input type="file" accept=".csv"
                        className="input-field text-sm file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-neon-violet/20 file:text-neon-violet cursor-pointer"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null;
                          setAccountingFile(f);
                          setAccountingResult(null);
                        }} />
                      {accountingFile && <p className="text-xs text-white/40 mt-1">{accountingFile.name}</p>}
                    </div>
                    {/* 手数料率 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-white/60 block mb-1">BASE グロースプラン 決済手数料（%）</label>
                        <input type="number" className="input-field" value={baseFeeRate}
                          onChange={e => setBaseFeeRate(Number(e.target.value))} min={0} max={30} step={0.1} />
                        <div className="mt-2">
                          <label className="text-xs text-white/60 block mb-1">BASE 月額固定費（¥）</label>
                          <input type="number" className="input-field" value={baseMonthlyFee}
                            onChange={e => setBaseMonthlyFee(Number(e.target.value))} min={0} step={10} />
                          <p className="text-xs text-white/30 mt-0.5">東京のみ。年払¥16,580・月払¥19,980</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">クレジットカード手数料（%）</label>
                        <input type="number" className="input-field" value={creditFeeRate}
                          onChange={e => setCreditFeeRate(Number(e.target.value))} min={0} max={10} step={0.01} />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 block mb-1">PayPay/QR手数料（%）</label>
                        <input type="number" className="input-field" value={qrFeeRate}
                          onChange={e => setQrFeeRate(Number(e.target.value))} min={0} max={10} step={0.01} />
                      </div>
                    </div>
                    <button onClick={runAccountingAnalysis} disabled={!accountingFile || accountingCalculating} className="btn-primary">
                      {accountingCalculating ? "分析中..." : "分析実行"}
                    </button>
                  </div>

                  {/* 結果 */}
                  {accountingResult && (() => {
                    const r = accountingResult;
                    const fmt = (n: number) => `¥${Math.round(n).toLocaleString()}`;
                    return (
                      <div className="space-y-4">
                        {/* 客数・客単価 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center">
                          {[
                            { label: "全取引数",       val: `${r.totalTx}件` },
                            { label: "来店取引",       val: `${r.onsiteTx}件` },
                            { label: "来店客数",       val: `${r.onsiteCustomers}人` },
                            { label: "来店客単価",     val: fmt(r.onsiteAvg), accent: true },
                          ].map(item => (
                            <div key={item.label} className="glass-dark p-3 rounded-lg">
                              <div className="text-white/40 mb-1">{item.label}</div>
                              <div className={`font-bold text-sm ${item.accent ? "text-star-300" : "text-white"}`}>{item.val}</div>
                            </div>
                          ))}
                        </div>

                        {/* 支払方法別 */}
                        <div className="glass-dark p-4 text-sm space-y-0">
                          <p className="text-xs text-white/40 mb-2 font-bold">支払方法別内訳</p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-white/40 border-b border-white/10">
                                <th className="text-left pb-1.5">支払方法</th>
                                <th className="text-right pb-1.5">件数</th>
                                <th className="text-right pb-1.5">合計金額</th>
                                <th className="text-right pb-1.5">手数料率</th>
                                <th className="text-right pb-1.5 text-neon-pink">推定手数料</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: "BASE（決済手数料）", stat: r.base, rateStr: `${baseFeeRate}%` },
                                { label: "クレジットカード",      stat: r.credit, rateStr: `${creditFeeRate}%` },
                                { label: "PayPay/QR決済",        stat: r.qr,     rateStr: `${qrFeeRate}%` },
                              ].map(({ label, stat, rateStr }) => (
                                <tr key={label} className="border-b border-white/5">
                                  <td className="py-1.5 text-white/80">{label}</td>
                                  <td className="text-right text-white/60">{stat.txCount}件</td>
                                  <td className="text-right text-white/80">{fmt(stat.amount)}</td>
                                  <td className="text-right text-white/40">{rateStr}</td>
                                  <td className="text-right text-neon-pink font-bold">{fmt(stat.fee)}</td>
                                </tr>
                              ))}
                              <tr className="border-b border-white/5">
                                <td className="py-1.5 text-white/80">現金</td>
                                <td className="text-right text-white/60">—</td>
                                <td className="text-right text-white/80">{fmt(r.cash)}</td>
                                <td className="text-right text-white/40">—</td>
                                <td className="text-right text-white/30">¥0</td>
                              </tr>
                              {baseMonthlyFee > 0 && (
                                <tr className="border-b border-white/5">
                                  <td className="py-1.5 text-white/80">BASE 月額固定費</td>
                                  <td className="text-right text-white/60">—</td>
                                  <td className="text-right text-white/40">—</td>
                                  <td className="text-right text-white/40">固定</td>
                                  <td className="text-right text-neon-pink font-bold">{fmt(baseMonthlyFee)}</td>
                                </tr>
                              )}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-white/20 font-bold">
                                <td className="pt-2 text-white" colSpan={2}>合計</td>
                                <td className="text-right pt-2 text-white">{fmt(r.totalSales)}</td>
                                <td className="text-right pt-2 text-white/40">—</td>
                                <td className="text-right pt-2 text-neon-pink">{fmt(r.totalFee)}</td>
                              </tr>
                              <tr>
                                <td className="pt-1 text-white/40 text-xs" colSpan={4}>手数料控除後</td>
                                <td className="text-right pt-1 font-bold text-star-300">{fmt(r.totalSales - r.totalFee)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {salarySummary && (
              <>
                {/* 損益計算書 */}
                <div className="glass p-6 space-y-1 text-sm">
                  <h2 className="font-bold text-star-300 mb-3">損益計算書</h2>
                  {(() => {
                    const s = salarySummary;
                    const fmt = (n: number) => `¥${Math.round(n).toLocaleString()}`;
                    const Row = ({ label, value, indent = 0, bold = false, accent = "" }: { label: string; value: string; indent?: number; bold?: boolean; accent?: string }) => (
                      <div className={`flex justify-between ${bold ? "font-bold" : ""} ${accent}`} style={{ paddingLeft: indent * 16 }}>
                        <span className="text-white/80">{label}</span>
                        <span>{value}</span>
                      </div>
                    );
                    const Divider = () => <div className="border-t border-white/20 my-1" />;
                    return (
                      <div className="space-y-0.5">
                        <Row label="売上（税込）" value={fmt(s.totalSalesTaxIncl)} bold />
                        <Row label="　遠隔" value={fmt(s.remoteSales)} indent={1} />
                        <Row label="　その他" value={fmt(s.localSales)} indent={1} />
                        <Row label="　消費税" value={`△ ${fmt(s.taxAmount)}`} indent={1} />
                        <Divider />
                        <Row label="売上（税抜）" value={fmt(s.totalSalesTaxIncl - s.taxAmount)} />
                        <Row label="仕入" value={`△ ${fmt(s.purchases)}`} />
                        <Row label="売上総利益" value={fmt(s.grossProfit)} bold />
                        <Divider />
                        <Row label="人件費" value={`△ ${fmt(s.laborCost)}`} />
                        <Row label="　キャスト給与合計" value={fmt(s.castPay)} indent={1} />
                        <Row label="　その他人件費" value="¥8,000" indent={1} />
                        <Divider />
                        <Row label="貢献利益" value={fmt(s.contributionProfit)} bold accent="text-star-300" />
                        <div className="text-xs text-white/40 mt-2">総労働時間: {s.workHours}</div>
                      </div>
                    );
                  })()}
                </div>

                {/* キャスト別支払額 */}
                <div className="glass p-6 space-y-3">
                  <h2 className="font-bold text-star-300">キャスト別支払額</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 text-xs border-b border-white/10">
                          <th className="text-left pb-2">キャスト名</th>
                          <th className="text-right pb-2">基本給</th>
                          <th className="text-right pb-2">通勤手当</th>
                          <th className="text-right pb-2">バック</th>
                          <th className="text-right pb-2">支払額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salarySummary.casts
                          .sort((a, b) => b.payment - a.payment)
                          .map(c => (
                          <tr key={c.castName} className="border-b border-white/5">
                            <td className="py-2">
                              <div className="font-medium text-white">{c.castName}</div>
                              <div className="text-xs text-white/40">{c.rank}</div>
                            </td>
                            <td className="text-right text-white/70">¥{c.basicPay.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{c.commute.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{Math.round(c.back).toLocaleString()}</td>
                            <td className="text-right font-bold text-star-300">¥{c.payment.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/20">
                          <td className="pt-2 font-bold text-white" colSpan={4}>合計</td>
                          <td className="pt-2 text-right font-bold text-neon-violet">
                            ¥{salarySummary.casts.reduce((a, c) => a + c.payment, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 売上詳細 */}
                <div className="glass p-6 space-y-3">
                  <h2 className="font-bold text-star-300">キャスト別売上・粗利</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white/50 text-xs border-b border-white/10">
                          <th className="text-left pb-2">キャスト名</th>
                          <th className="text-right pb-2">総売上</th>
                          <th className="text-right pb-2">粗利</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salarySummary.casts
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .map(c => (
                          <tr key={c.castName} className="border-b border-white/5">
                            <td className="py-2 font-medium text-white">{c.castName}</td>
                            <td className="text-right text-white/70">¥{c.totalSales.toLocaleString()}</td>
                            <td className="text-right text-white/70">¥{Math.round(c.grossProfit).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* 給与履歴 */}
            <div className="glass p-4">
              <button className="w-full flex items-center justify-between text-left" onClick={() => setShowHistory(p => !p)}>
                <span className="font-bold text-star-300">📋 給与履歴</span>
                <span className="text-white/40 text-sm">{showHistory ? "▲ 閉じる" : "▼ 開く"}</span>
              </button>
              {showHistory && (
                <div className="mt-4 space-y-4">
                  {salaryPeriods.length === 0 ? (
                    <p className="text-white/40 text-sm text-center py-4">保存された給与データがありません</p>
                  ) : (
                    <>
                      {(() => {
                        // Group by storeName|year|month
                        const grouped = new Map<string, SalaryPeriod[]>();
                        for (const p of salaryPeriods) {
                          const key = `${p.storeName}|${p.year}|${p.month}`;
                          if (!grouped.has(key)) grouped.set(key, []);
                          grouped.get(key)!.push(p);
                        }
                        return Array.from(grouped.entries()).map(([key, periods]) => {
                          const parts = key.split("|");
                          const storeName = parts[0] ?? "";
                          const year = Number(parts[1] ?? 0);
                          const month = Number(parts[2] ?? 0);
                          const h0 = periods.find(p => p.half === 0);
                          const h1 = periods.find(p => p.half === 1);
                          const h2 = periods.find(p => p.half === 2);
                          // 表示する合計: 全体があればそれ、なければ前後半の合算
                          const sumFrom = h0 ? [h0] : [h1, h2].filter(Boolean) as SalaryPeriod[];
                          const totalSales = sumFrom.reduce((s, p) => s + (p.summaryRecord?.totalSalesTaxIncl ?? 0), 0);
                          const grossProfit = sumFrom.reduce((s, p) => s + (p.summaryRecord?.grossProfit ?? 0), 0);
                          const castPay = sumFrom.reduce((s, p) => s + (p.summaryRecord?.castPay ?? 0), 0);
                          const laborCost = sumFrom.reduce((s, p) => s + (p.summaryRecord?.laborCost ?? 0), 0);
                          const contribProfit = sumFrom.reduce((s, p) => s + (p.summaryRecord?.contributionProfit ?? 0), 0);
                          return (
                            <div key={key} className="glass-dark p-4 space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <h3 className="font-bold text-white">{storeName} {year}/{String(month).padStart(2, "0")}</h3>
                                {sumFrom.length > 0 && (
                                  <div className="text-xs text-white/50">
                                    売上: ¥{Math.round(totalSales).toLocaleString()}
                                    <span className={`ml-3 font-bold ${contribProfit >= 0 ? "text-star-300" : "text-neon-pink"}`}>
                                      貢献利益: ¥{Math.round(contribProfit).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {/* Period buttons (全体 or 前半/後半) */}
                              <div className="flex gap-3 flex-wrap">
                                {[...periods].sort((a, b) => a.half - b.half).map(p => {
                                  const isSelected = historyDetail?.id === p.id;
                                  return (
                                    <div key={p.id} className="flex items-center gap-1">
                                      <button
                                        onClick={() => { setHistoryDetail(null); loadHistoryDetail(p.id); }}
                                        className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${isSelected ? "border-neon-violet bg-neon-violet/20 text-neon-violet" : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"}`}
                                      >
                                        {halfLabel(p.half)}
                                        {p.summaryRecord && <span className="ml-1.5 text-white/40">給与 ¥{Math.round(p.summaryRecord.castPay).toLocaleString()}</span>}
                                      </button>
                                      <button onClick={() => deleteHistoryPeriod(p.id)} className="text-neon-pink/60 hover:text-neon-pink text-xs px-1" title="削除">✕</button>
                                    </div>
                                  );
                                })}
                              </div>
                              {/* Monthly aggregate: 前後半が両方そろった場合のみ */}
                              {!h0 && h1 && h2 && (
                                <div className="border-t border-white/10 pt-3">
                                  <p className="text-xs text-white/40 mb-2">1ヶ月合計</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-center">
                                    {[
                                      { label: "売上(税込)", val: totalSales },
                                      { label: "売上総利益", val: grossProfit },
                                      { label: "キャスト給与", val: castPay },
                                      { label: "人件費", val: laborCost },
                                      { label: "貢献利益", val: contribProfit, accent: true },
                                    ].map(item => (
                                      <div key={item.label} className="glass p-2 rounded-lg">
                                        <div className="text-white/40">{item.label}</div>
                                        <div className={`font-bold ${item.accent ? (contribProfit >= 0 ? "text-star-300" : "text-neon-pink") : "text-white"}`}>
                                          ¥{Math.round(item.val).toLocaleString()}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {/* Detail view */}
                      {historyDetail && (
                        <div className="glass p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-star-300">
                              {historyDetail.storeName} {historyDetail.year}/{String(historyDetail.month).padStart(2, "0")} {halfLabel(historyDetail.half)} 詳細
                            </h3>
                            <button onClick={() => setHistoryDetail(null)} className="text-white/40 hover:text-white text-sm">✕ 閉じる</button>
                          </div>
                          {/* P&L */}
                          {historyDetail.summaryRecord && (() => {
                            const s = historyDetail.summaryRecord;
                            const fmt = (n: number) => `¥${Math.round(n).toLocaleString()}`;
                            return (
                              <div className="glass-dark p-4 text-sm space-y-0.5">
                                <div className="flex justify-between font-bold"><span className="text-white/80">売上（税込）</span><span>{fmt(s.totalSalesTaxIncl)}</span></div>
                                <div className="flex justify-between text-white/50 pl-4"><span>遠隔</span><span>{fmt(s.remoteSales)}</span></div>
                                <div className="flex justify-between text-white/50 pl-4"><span>その他</span><span>{fmt(s.localSales)}</span></div>
                                <div className="flex justify-between text-white/50 pl-4"><span>消費税</span><span>△ {fmt(s.taxAmount)}</span></div>
                                <div className="border-t border-white/10 my-1.5" />
                                <div className="flex justify-between"><span className="text-white/80">売上（税抜）</span><span>{fmt(s.totalSalesTaxIncl - s.taxAmount)}</span></div>
                                <div className="flex justify-between font-bold"><span className="text-white/80">売上総利益</span><span>{fmt(s.grossProfit)}</span></div>
                                <div className="flex justify-between text-white/80"><span>人件費</span><span>△ {fmt(s.laborCost)}</span></div>
                                <div className="flex justify-between text-white/50 pl-4"><span>キャスト給与</span><span>{fmt(s.castPay)}</span></div>
                                <div className="flex justify-between text-white/50 pl-4"><span>その他人件費</span><span>¥8,000</span></div>
                                <div className="border-t border-white/10 my-1.5" />
                                <div className={`flex justify-between font-bold ${s.contributionProfit >= 0 ? "text-star-300" : "text-neon-pink"}`}><span>貢献利益</span><span>{fmt(s.contributionProfit)}</span></div>
                                <div className="text-xs text-white/30 mt-1">総労働時間: {s.workHours}</div>
                              </div>
                            );
                          })()}
                          {/* Cast table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-white/50 text-xs border-b border-white/10">
                                  <th className="text-left pb-2">キャスト名</th>
                                  <th className="text-right pb-2">基本給</th>
                                  <th className="text-right pb-2">通勤</th>
                                  <th className="text-right pb-2">バック</th>
                                  <th className="text-right pb-2">支払額</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...historyDetail.castRecords]
                                  .sort((a, b) => b.payment - a.payment)
                                  .map(c => (
                                    <tr key={c.castName} className="border-b border-white/5">
                                      <td className="py-2">
                                        <div className="font-medium text-white">{c.hpName || c.castName}</div>
                                        <div className="text-xs text-white/40">{c.rank}</div>
                                      </td>
                                      <td className="text-right text-white/70">¥{c.basicPay.toLocaleString()}</td>
                                      <td className="text-right text-white/70">¥{c.commute.toLocaleString()}</td>
                                      <td className="text-right text-white/70">¥{Math.round(c.back).toLocaleString()}</td>
                                      <td className="text-right font-bold text-star-300">¥{c.payment.toLocaleString()}</td>
                                    </tr>
                                  ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-white/20">
                                  <td className="pt-2 font-bold text-white" colSpan={4}>合計</td>
                                  <td className="pt-2 text-right font-bold text-neon-violet">
                                    ¥{historyDetail.castRecords.reduce((a, c) => a + c.payment, 0).toLocaleString()}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ポイント付与 */}
        {tab === "points" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">付与ポイント数を選択</h2>
              <div className="flex gap-2 flex-wrap mb-2">
                {[100, 500, 1000, 3000].map(v => (
                  <button key={v} onClick={() => setGrantAmount(v)} className={`px-3 py-1 rounded-full text-sm border transition-all ${grantAmount === v ? "border-neon-purple text-neon-purple" : "border-white/20 text-white/60"}`}>
                    {v.toLocaleString()} pt
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs text-white/60 block mb-1">カスタム数量</label>
                <input type="number" className="input-field" value={grantAmount} onChange={e => setGrantAmount(Number(e.target.value))} min={1} />
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">会員一覧（クリックで付与）</h2>
              <div>
                <input
                  className="input-field"
                  placeholder="メール・ニックネームで絞り込み..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers
                  .filter(c => c.email.includes(customerSearch) || (c.name ?? "").includes(customerSearch))
                  .map(c => (
                    <div key={c.id} className="glass-dark p-3 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{c.email}</div>
                        {c.name && <div className="text-xs text-neon-violet truncate">ニック: {c.name}</div>}
                        {(c.favoriteCast1Name || c.favoriteCast2Name) && (
                          <div className="text-xs text-white/60 truncate">
                            推し: {[c.favoriteCast1Name, c.favoriteCast2Name].filter(Boolean).join(" / ")}
                          </div>
                        )}
                        <div className="text-xs text-white/40 flex flex-wrap gap-2 mt-0.5">
                          <span>残高: <span className="text-star-300">{c.balance.toLocaleString()} pt</span></span>
                          {c.birthdate && (
                            <span>生年月日: <span className="text-white/60">{new Date(c.birthdate).toLocaleDateString("ja-JP")}</span></span>
                          )}
                          {!c.emailVerified && <span className="text-yellow-500">メール未認証</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.birthdate && (
                          c.ageVerified ? (
                            <button onClick={() => verifyAge(c.id, false)} className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 transition-all whitespace-nowrap">
                              ✓ 年齢確認済
                            </button>
                          ) : (
                            <button onClick={() => verifyAge(c.id, true)} className="text-xs px-2 py-1 rounded-full border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/20 transition-all whitespace-nowrap">
                              年齢確認する
                            </button>
                          )
                        )}
                        <button
                          onClick={() => grantPoints(c.email)}
                          disabled={grantAmount < 1}
                          className="btn-primary text-sm whitespace-nowrap"
                        >
                          +{grantAmount.toLocaleString()} pt
                        </button>
                      </div>
                    </div>
                  ))}
                {customers.filter(c => c.email.includes(customerSearch)).length === 0 && (
                  <p className="text-white/40 text-sm text-center py-4">会員が見つかりません</p>
                )}
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">メールアドレスで直接付与</h2>
              <div>
                <label className="text-xs text-white/60 block mb-1">メールアドレス</label>
                <input
                  className="input-field"
                  value={grantEmail}
                  onChange={e => setGrantEmail(e.target.value)}
                  placeholder="customer@example.com"
                  type="email"
                />
              </div>
              <button
                onClick={() => { grantPoints(grantEmail); setGrantEmail(""); }}
                disabled={!grantEmail || grantAmount < 1}
                className="btn-primary"
              >
                {grantAmount.toLocaleString()} pt を付与する
              </button>
            </div>
          </div>
        )}

        {/* メニュー管理 */}
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingMenu ? "メニュー画像編集" : "メニュー画像追加"}</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">画像 <span className="text-neon-pink">*</span></label>
                  <div className="flex gap-3 items-start">
                    {menuForm.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={menuForm.imageUrl} alt="プレビュー" className="w-16 h-20 object-cover rounded-lg border border-white/20 flex-shrink-0" />
                    )}
                    <div className="flex-1 space-y-2">
                      <label className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed cursor-pointer transition-all ${uploadingMenu ? "border-white/20 text-white/30" : "border-neon-violet text-neon-violet hover:bg-neon-violet/10"}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <span className="text-sm">{uploadingMenu ? "アップロード中..." : "画像を選択"}</span>
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingMenu} onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuImage(f); }} />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 block mb-1">説明テキスト（alt） <span className="text-neon-pink">*</span></label>
                    <input className="input-field" value={menuForm.alt} onChange={e => setMenuForm(p => ({ ...p, alt: e.target.value }))} placeholder="例: フードメニュー 1" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 block mb-1">表示順</label>
                    <input type="number" className="input-field" value={menuForm.order} onChange={e => setMenuForm(p => ({ ...p, order: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveMenuItem} disabled={uploadingMenu} className="btn-primary text-sm">{editingMenu ? "更新" : "追加"}</button>
                {editingMenu && <button onClick={() => { setEditingMenu(null); setMenuForm(MENU_EMPTY); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>

            <div className="space-y-2">
              {menuItems.map((item, i) => (
                <div key={item.id} className="glass-dark p-3 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl} alt={item.alt} className="w-12 h-14 object-cover rounded-lg flex-shrink-0 bg-white/5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{item.alt}</div>
                    <div className="text-xs text-white/40">順番: {item.order}（{i + 1}/{menuItems.length}）</div>
                  </div>
                  <button onClick={() => { setMenuForm({ imageUrl: item.imageUrl, alt: item.alt, order: item.order }); setEditingMenu(item.id); setTab("menu"); }} className="text-neon-violet text-sm hover:text-neon-purple flex-shrink-0">編集</button>
                  <button onClick={() => deleteMenuItem(item.id)} className="text-neon-pink text-sm hover:text-red-400 flex-shrink-0">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* リセット履歴 */}
        {tab === "resets" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-star-300">月次ポイントリセット履歴</h2>
                <button
                  onClick={runMonthlyReset}
                  disabled={resetting}
                  className="btn-primary text-sm"
                >
                  {resetting ? "実行中..." : "手動リセット実行"}
                </button>
              </div>
              <p className="text-xs text-white/40">毎月1日午前5時にcronで自動実行されます。テスト用に手動実行もできます。</p>
            </div>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto">
              {resetLogs.length === 0 && (
                <p className="text-white/40 text-sm text-center py-8">リセット履歴がありません</p>
              )}
              {resetLogs.map(r => (
                <div key={r.id} className="glass-dark p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white text-sm truncate">{r.email ?? r.userId}</div>
                    <div className="text-xs text-white/40">{new Date(r.createdAt).toLocaleString("ja-JP")}</div>
                  </div>
                  <div className="text-neon-pink text-sm font-bold flex-shrink-0">-{r.amount.toLocaleString()} pt</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 称号マスタ */}
        {tab === "titles" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-4">
              <h2 className="font-bold text-star-300">{editingTitle ? "称号編集" : "称号追加"}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">称号名</label>
                  <input className="input-field" value={titleForm.name} onChange={e => setTitleForm(p => ({ ...p, name: e.target.value }))} placeholder="称号名" />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">閾値（累計GIFTポイント）</label>
                  <input type="number" className="input-field" value={titleForm.threshold} onChange={e => setTitleForm(p => ({ ...p, threshold: Number(e.target.value) }))} min={0} />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">表示順</label>
                  <input type="number" className="input-field" value={titleForm.order} onChange={e => setTitleForm(p => ({ ...p, order: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={saveTitle} className="btn-primary text-sm">{editingTitle ? "更新" : "追加"}</button>
                {editingTitle && <button onClick={() => { setEditingTitle(null); setTitleForm({ name: "", threshold: 0, order: 0 }); }} className="btn-secondary text-sm">キャンセル</button>}
              </div>
            </div>
            <div className="space-y-2">
              {titles.map(t => (
                <div key={t.id} className="glass-dark p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-bold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.threshold.toLocaleString()} pt〜</div>
                  </div>
                  <button onClick={() => { setTitleForm({ name: t.name, threshold: t.threshold, order: t.order }); setEditingTitle(t.id); }} className="text-neon-violet text-sm hover:text-neon-purple">編集</button>
                  <button onClick={() => deleteTitle(t.id)} className="text-neon-pink text-sm hover:text-red-400">削除</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
