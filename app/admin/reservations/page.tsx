"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NavBar from "@/components/ui/NavBar";
import {
  SETTINGS,
  SOURCE_LABEL,
  STATUS_LABEL,
  ALLOWED_TRANSITIONS,
  addDays,
  jstNow,
  timeOptions,
  type ReservationStatus,
  type ReservationSource,
} from "@/lib/reservation";

interface Reservation {
  id: string;
  storeId: string;
  storeName: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  customerName: string;
  phone: string;
  note: string;
  /// お客様の自己申告。照合はしていない
  purchaseId: string;
  /// BASEの注文IDらしい形かどうか。照合結果ではない
  purchaseIdLooksValid: boolean;
  status: ReservationStatus;
  source: ReservationSource;
  createdAt: string;
  overdue: boolean;
}
interface Store { id: string; name: string }
interface EventRow {
  id: string;
  fromStatus: string;
  toStatus: string;
  actorEmail: string;
  memo: string;
  createdAt: string;
}

/** 状態ごとの色。未対応が埋もれないよう、未対応だけ強い色にする */
const STATUS_STYLE: Record<ReservationStatus, string> = {
  PENDING:   "bg-star-400 text-black",
  CONFIRMED: "bg-neon-violet text-white",
  DECLINED:  "bg-white/15 text-white/70",
  CANCELED:  "bg-white/15 text-white/70",
  VISITED:   "bg-neon-cyan/80 text-black",
  NO_SHOW:   "bg-red-500/80 text-white",
};

const MANUAL_EMPTY = {
  storeId: "",
  visitDate: "",
  visitTime: "",
  partySize: 1,
  customerName: "",
  phone: "",
  note: "",
  purchaseId: "",
  source: "PHONE" as ReservationSource,
  status: "CONFIRMED" as "PENDING" | "CONFIRMED",
};

export default function ReservationLedgerPage() {
  const today = useMemo(() => jstNow().date, []);
  const [stores, setStores] = useState<Store[]>([]);
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // 絞り込み
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 60));

  // 手入力
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState(MANUAL_EMPTY);
  const [saving, setSaving] = useState(false);

  // 履歴
  const [openId, setOpenId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  const times = useMemo(() => timeOptions(), []);
  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m); else setMsg(m);
    setTimeout(() => { setMsg(""); setErr(""); }, 4000);
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ from, to });
    if (storeId) q.set("storeId", storeId);
    if (status) q.set("status", status);
    const res = await fetch(`/api/admin/reservations?${q}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    const data = await res.json().catch(() => ({ reservations: [] }));
    setRows(data.reservations ?? []);
    setLoading(false);
  }, [from, to, storeId, status]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    fetch("/api/stores")
      .then(r => (r.ok ? r.json() : []))
      .then((d: Store[]) => setStores(d.map(s => ({ id: s.id, name: s.name }))))
      .catch(() => setStores([]));
  }, []);

  const changeStatus = async (id: string, next: ReservationStatus) => {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { flash(data.error ?? "変更できませんでした", true); return; }
    flash(`「${STATUS_LABEL[next]}」にしました`);
    fetchRows();
    if (openId === id) loadEvents(id);
  };

  const loadEvents = async (id: string) => {
    const res = await fetch(`/api/admin/reservations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setEvents(data.reservation?.events ?? []);
  };

  const toggleDetail = (id: string) => {
    if (openId === id) { setOpenId(null); setEvents([]); return; }
    setOpenId(id);
    setEvents([]);
    loadEvents(id);
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manual, partySize: Number(manual.partySize) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash(data.error ?? "登録できませんでした", true); return; }
      flash("台帳に登録しました");
      setManual(MANUAL_EMPTY);
      setShowManual(false);
      fetchRows();
    } finally {
      setSaving(false);
    }
  };

  const pending = rows.filter(r => r.status === "PENDING");
  const others  = rows.filter(r => r.status !== "PENDING");

  if (forbidden)
    return (
      <>
        <NavBar />
        <main className="min-h-screen pt-24 px-4 max-w-2xl mx-auto">
          <p className="glass p-6 text-center">
            この画面は管理者のみです。<Link href="/auth/login" className="text-neon-violet underline ml-1">ログイン</Link>
          </p>
        </main>
      </>
    );

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-24 pb-16 px-4 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black gradient-text">📖 予約台帳</h1>
          <Link href="/admin" className="ml-auto text-white/40 hover:text-white/70 text-sm">
            ← 管理画面
          </Link>
        </div>

        {msg && <div className="glass p-3 text-green-400 text-center text-sm">{msg}</div>}
        {err && <div className="glass p-3 text-neon-pink text-center text-sm">{err}</div>}

        {/* 絞り込み */}
        <div className="glass p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="text-xs text-white/60">店舗</span>
            <select className="input-field mt-1" value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">すべて</option>
              {stores.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-white/60">状態</span>
            <select className="input-field mt-1" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">すべて</option>
              {(Object.keys(STATUS_LABEL) as ReservationStatus[]).map(s => (
                <option key={s} value={s} className="text-black">{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-white/60">来店日 開始</span>
            <input type="date" className="input-field mt-1" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-white/60">来店日 終了</span>
            <input type="date" className="input-field mt-1" value={to} onChange={e => setTo(e.target.value)} />
          </label>
        </div>

        {/* 手入力 */}
        <div className="glass p-4">
          <button onClick={() => setShowManual(!showManual)} className="text-sm text-neon-violet hover:text-neon-purple">
            {showManual ? "閉じる" : "＋ 例外的に手入力する"}
          </button>
          {showManual && (
            // 予約は一律で公式HPのフォームに寄せる運用（要件書 第6章 #10）。
            // ここは当日の電話など、フォームを開いてもらえないときの逃げ道
            <p className="mt-2 text-white/50 text-xs leading-relaxed">
              ご予約は原則、お客様に公式HPのフォームからお申し込みいただきます。
              ここはその場でフォームを開いてもらえないとき（当日のお電話など）の入口です。
              受付の締切や過去日の制限はかかりません。
            </p>
          )}
          {showManual && (
            <form onSubmit={submitManual} className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              <select className="input-field" required value={manual.storeId}
                onChange={e => setManual({ ...manual, storeId: e.target.value })}>
                <option value="">店舗</option>
                {stores.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
              </select>
              <input type="date" className="input-field" required value={manual.visitDate}
                onChange={e => setManual({ ...manual, visitDate: e.target.value })} />
              <select className="input-field" required value={manual.visitTime}
                onChange={e => setManual({ ...manual, visitTime: e.target.value })}>
                <option value="">時間</option>
                {times.map(t => <option key={t} value={t} className="text-black">{t}</option>)}
              </select>
              <select className="input-field" value={manual.partySize}
                onChange={e => setManual({ ...manual, partySize: Number(e.target.value) })}>
                {Array.from({ length: SETTINGS.maxPartySize }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n} className="text-black">{n}名</option>
                ))}
              </select>
              <input className="input-field" required placeholder="お名前" value={manual.customerName}
                onChange={e => setManual({ ...manual, customerName: e.target.value })} />
              <input className="input-field" required placeholder="電話番号" inputMode="tel" value={manual.phone}
                onChange={e => setManual({ ...manual, phone: e.target.value })} />
              <select className="input-field" value={manual.source}
                onChange={e => setManual({ ...manual, source: e.target.value as ReservationSource })}>
                {(Object.keys(SOURCE_LABEL) as ReservationSource[]).map(s => (
                  <option key={s} value={s} className="text-black">{SOURCE_LABEL[s]}で受付</option>
                ))}
              </select>
              <select className="input-field" value={manual.status}
                onChange={e => setManual({ ...manual, status: e.target.value as "PENDING" | "CONFIRMED" })}>
                <option value="CONFIRMED" className="text-black">確定として入れる</option>
                <option value="PENDING" className="text-black">未対応として入れる</option>
              </select>
              <input className="input-field" placeholder="遠隔ドリンクの購入ID（任意）" value={manual.purchaseId}
                onChange={e => setManual({ ...manual, purchaseId: e.target.value })} />
              <input className="input-field md:col-span-2" placeholder="メモ（電話・DMで聞いた内容）" value={manual.note}
                onChange={e => setManual({ ...manual, note: e.target.value })} />
              <button type="submit" className="btn-primary py-2" disabled={saving}>
                {saving ? "登録中..." : "台帳に登録"}
              </button>
            </form>
          )}
        </div>

        {loading ? (
          <p className="text-white/50 text-center py-8">読み込み中...</p>
        ) : (
          <>
            <Section
              title={`未対応 ${pending.length}件`}
              empty="未対応の申し込みはありません"
              rows={pending}
              openId={openId}
              events={events}
              onToggle={toggleDetail}
              onChange={changeStatus}
            />
            <Section
              title={`対応済み ${others.length}件`}
              empty="この条件の予約はありません"
              rows={others}
              openId={openId}
              events={events}
              onToggle={toggleDetail}
              onChange={changeStatus}
            />
          </>
        )}

        <p className="text-white/40 text-xs leading-relaxed">
          承認 / 却下の結果は、公式LINEのトークから手動でご連絡ください（第1段階では自動通知はしません）。
          受付から{SETTINGS.approveWithinHours}時間を過ぎた未対応には ⚠️ が付きます
          （{SETTINGS.replyFrom}〜24:00 だけを数えるので、深夜に届いた分は朝の時点では点きません）。
          定休日・営業時間はシステムに入っていないので、受けられない日時の申し込みは「お断り」で返してください。
        </p>
      </main>
    </>
  );
}

function Section({
  title, empty, rows, openId, events, onToggle, onChange,
}: {
  title: string;
  empty: string;
  rows: Reservation[];
  openId: string | null;
  events: EventRow[];
  onToggle: (id: string) => void;
  onChange: (id: string, next: ReservationStatus) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-white/70">{title}</h2>
      {rows.length === 0 ? (
        <p className="glass p-4 text-white/40 text-sm">{empty}</p>
      ) : (
        rows.map(r => (
          <div key={r.id} className={`glass p-4 ${r.overdue ? "border-star-400/60" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
              {r.overdue && <span className="text-star-400 text-xs">⚠️ 承認の目安時間を過ぎています</span>}
              {/* 承認を優先する判断材料。照合前なので「申告あり」としか言えない */}
              {r.purchaseId && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neon-cyan/80 text-black">
                  遠隔購入の申告あり
                </span>
              )}
              <span className="font-semibold">
                {r.visitDate} {r.visitTime}
              </span>
              <span className="text-white/70 text-sm">{r.storeName}</span>
              <span className="text-white/70 text-sm">{r.partySize}名</span>
              <span className="text-white/90">{r.customerName} 様</span>
              <a href={`tel:${r.phone}`} className="text-neon-cyan text-sm underline">{r.phone}</a>
              <span className="text-white/40 text-xs">{SOURCE_LABEL[r.source]}受付</span>
              <button onClick={() => onToggle(r.id)} className="ml-auto text-white/50 hover:text-white text-xs">
                {openId === r.id ? "履歴を閉じる" : "履歴"}
              </button>
            </div>

            {r.purchaseId && (
              <p className="mt-2 text-sm text-white/70">
                購入ID（未照合）: <span className="font-mono">{r.purchaseId}</span>
                {!r.purchaseIdLooksValid && (
                  <span className="text-star-400 ml-2">⚠️ BASEの注文IDの形（16桁）と違います</span>
                )}
                <span className="block text-white/40 text-xs mt-0.5">
                  お客様の自己申告です。承認を優先する前にBASEの管理画面で突き合わせてください
                </span>
              </p>
            )}

            {r.note && <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">メモ: {r.note}</p>}

            {ALLOWED_TRANSITIONS[r.status].length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {ALLOWED_TRANSITIONS[r.status].map(next => (
                  <button
                    key={next}
                    onClick={() => onChange(r.id, next)}
                    className="px-3 py-1.5 rounded-full text-xs glass text-white/80 hover:text-white hover:border-neon-violet"
                  >
                    {STATUS_LABEL[next]}にする
                  </button>
                ))}
              </div>
            )}

            {openId === r.id && (
              <div className="mt-3 border-t border-white/10 pt-3 space-y-1">
                {events.length === 0 ? (
                  <p className="text-white/40 text-xs">読み込み中...</p>
                ) : (
                  events.map(e => (
                    <p key={e.id} className="text-xs text-white/50">
                      {new Date(e.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      {" — "}
                      {e.fromStatus ? `${STATUS_LABEL[e.fromStatus as ReservationStatus]} → ` : ""}
                      {STATUS_LABEL[e.toStatus as ReservationStatus]}
                      {e.actorEmail && ` / ${e.actorEmail}`}
                      {e.memo && ` / ${e.memo}`}
                    </p>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
