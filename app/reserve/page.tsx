"use client";
import { useEffect, useMemo, useState } from "react";
import NavBar from "@/components/ui/NavBar";
import { SETTINGS, addDays, jstNow, timeOptions } from "@/lib/reservation";

interface Store { id: string; name: string }

const EMPTY = {
  storeId: "",
  visitDate: "",
  visitTime: "",
  partySize: 1,
  customerName: "",
  phone: "",
  purchaseId: "",
};

export default function ReservePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // 日付の下限・上限はJSTで出す（サーバーがUTCでも入力欄がずれないように）
  const today = useMemo(() => jstNow().date, []);
  const maxDate = useMemo(() => addDays(today, SETTINGS.maxDaysAhead), [today]);
  const times = useMemo(() => timeOptions(), []);

  useEffect(() => {
    fetch("/api/stores")
      .then(r => (r.ok ? r.json() : []))
      .then((d: Store[]) => setStores(d.map(s => ({ id: s.id, name: s.name }))))
      .catch(() => setStores([]));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setSending(true);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, partySize: Number(form.partySize) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "送信できませんでした。時間をおいてお試しください");
        return;
      }
      setDone(true);
    } catch {
      setErr("通信に失敗しました。電波の良い場所でお試しください");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen star-bg">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 pt-24 pb-16">
        <h1 className="text-2xl font-bold gradient-text mb-2">ご予約のお申し込み</h1>

        {done ? (
          <div className="glass p-6 mt-6 space-y-4">
            <p className="text-lg font-semibold">お申し込みを受け付けました。</p>
            {/* 承認制であることは、ここで曖昧にしない */}
            <p className="text-white/80 leading-relaxed">
              この時点ではまだ<strong className="text-star-400">ご予約は確定していません</strong>。
              店舗が内容を確認し、公式LINEのトークから確定 / 満席のご連絡をいたします。
              少々お待ちください。
            </p>
            <p className="text-white/60 text-sm">
              お急ぎの場合や、当日のご来店時間が変わる場合は、公式LINEからご連絡ください。
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              お申し込みの時点ではご予約は確定しません。店舗が内容を確認したうえで、
              公式LINEのトークから確定 / 満席のご連絡をいたします。
            </p>

            <form onSubmit={submit} className="glass p-6 space-y-5">
              <Field label="店舗" required>
                <select
                  className="input-field"
                  required
                  value={form.storeId}
                  onChange={e => setForm({ ...form, storeId: e.target.value })}
                >
                  <option value="">選択してください</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="来店日" required>
                <input
                  type="date"
                  className="input-field"
                  required
                  min={today}
                  max={maxDate}
                  value={form.visitDate}
                  onChange={e => setForm({ ...form, visitDate: e.target.value })}
                />
                <p className="text-white/50 text-xs mt-1">
                  {SETTINGS.maxDaysAhead}日先まで承っています
                </p>
              </Field>

              <Field label="来店時間" required>
                <select
                  className="input-field"
                  required
                  value={form.visitTime}
                  onChange={e => setForm({ ...form, visitTime: e.target.value })}
                >
                  <option value="">選択してください</option>
                  {times.map(t => (
                    <option key={t} value={t} className="text-black">{t}</option>
                  ))}
                </select>
              </Field>

              <Field label="人数" required>
                <select
                  className="input-field"
                  required
                  value={form.partySize}
                  onChange={e => setForm({ ...form, partySize: Number(e.target.value) })}
                >
                  {Array.from({ length: SETTINGS.maxPartySize }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n} className="text-black">{n}名</option>
                  ))}
                </select>
              </Field>

              <Field label="お名前" required>
                <input
                  className="input-field"
                  required
                  maxLength={50}
                  placeholder="星野 狼"
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                />
              </Field>

              <Field label="電話番号" required>
                <input
                  className="input-field"
                  required
                  inputMode="tel"
                  placeholder="09012345678"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
                <p className="text-white/50 text-xs mt-1">当日のご連絡に使わせていただきます</p>
              </Field>

              {/* 遠隔で買ってくれた方を承認で優先するために聞く。購入は予約の条件ではないので、
                  空欄でも申し込めることを欄のすぐ下に書く（必須と誤解されて離脱するのを防ぐ） */}
              <Field label="遠隔ドリンクの購入ID（任意）">
                <input
                  className="input-field"
                  maxLength={64}
                  placeholder="1AE7F1F358D8940C"
                  value={form.purchaseId}
                  onChange={e => setForm({ ...form, purchaseId: e.target.value })}
                />
                <p className="text-white/50 text-xs mt-1">
                  BASEの注文確認メールに記載の16桁の番号です。<br />
                  ※購入しなくても予約申請はできます
                </p>
              </Field>

              <p className="text-white/50 text-xs leading-relaxed">
                ご来店時に年齢確認をさせていただきます。身分証をお持ちください。<br />
                {/* 直前の申し込みはフォームでは受けず、公式LINEで受ける運用（要件書 第6章 #3） */}
                ご来店の{SETTINGS.sameDayCutoffMinutes}分前を過ぎてからのご予約は、
                公式LINEのトークから直接ご連絡ください。
              </p>

              {err && (
                <p className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
                  {err}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={sending}>
                {sending ? "送信中..." : "この内容で申し込む"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-white/80">
        {label}
        {required && <span className="text-neon-pink ml-1">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
