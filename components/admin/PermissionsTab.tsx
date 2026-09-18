"use client";

import { useEffect, useState } from "react";

/**
 * 権限管理（OWNER だけ）。機能 × ロール（店長 / キャスト）の可否を1マスずつ切り替える。
 * OWNER は常に全部可で表に出さない。「権限管理」の行はオーナー固定。
 * 店長の招待（キャストマスタに無い人）もここから
 */
interface Feature { key: string; label: string; icon: string; description: string; ownerOnly?: boolean }
interface Staff { id: string; email: string; name: string | null; role: string; roleLabel: string; cast: { name: string; castCode: string } | null; createdAt: string }
interface Resp { features: Feature[]; table: Record<string, Record<string, boolean>>; staff: Staff[] }

const ROLES: { key: "MANAGER" | "CAST"; label: string }[] = [{ key: "MANAGER", label: "店長" }, { key: "CAST", label: "キャスト" }];

export default function PermissionsTab({ flash }: { flash: (m: string, isErr?: boolean) => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = () =>
    fetch("/api/admin/permissions")
      .then(async r => { const d = await r.json(); if (r.ok) { setData(d); setError(null); } else setError(d.error ?? "取得に失敗しました"); })
      .catch(() => setError("通信に失敗しました"));
  useEffect(() => { void load(); }, []);

  const toggle = async (role: "MANAGER" | "CAST", feature: string, allowed: boolean) => {
    const res = await fetch("/api/admin/permissions", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, feature, allowed }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { flash(d.error ?? "変更できませんでした", true); return; }
    setData(prev => prev ? { ...prev, table: d.table } : prev);
    flash("権限を更新しました");
  };

  const inviteManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/admin/permissions/invite", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error ?? "招待に失敗しました", true); return; }
      if (d.devUrl) prompt("メール送信が未設定のため、このリンクを本人に渡してください（7日間有効）", d.devUrl);
      else flash(`${d.email} に店長の招待メールを送りました（7日間有効）`);
      setInviteEmail("");
    } finally { setInviting(false); }
  };

  if (error) return <div className="glass p-4 text-sm text-neon-pink">{error}</div>;
  if (!data) return <div className="glass p-6 text-center text-white/50 text-sm">読み込み中...</div>;

  return (
    <div className="space-y-6" data-testid="permissions-tab">
      <div className="glass p-4 space-y-3">
        <h2 className="font-bold text-star-300">🔐 ロールごとの権限</h2>
        <p className="text-xs text-white/50">
          オーナーは常にすべて使えます。店長・キャストの可否をここで切り替えます（変更はすぐ効きます）。
          キャストの「報酬」（本人分）は権限に関係なく常に見られます。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="permissions-table">
            <thead>
              <tr className="text-white/50 text-xs border-b border-white/10">
                <th className="text-left px-3 py-2">機能</th>
                {ROLES.map(r => <th key={r.key} className="text-center px-3 py-2">{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.features.map(f => (
                <tr key={f.key} className="border-b border-white/5">
                  <td className="px-3 py-2">
                    <span className="mr-1" aria-hidden="true">{f.icon}</span>{f.label}
                    <span className="block text-[11px] text-white/40">{f.description}</span>
                  </td>
                  {ROLES.map(r => (
                    <td key={r.key} className="px-3 py-2 text-center">
                      {f.ownerOnly ? (
                        <span className="text-white/30 text-xs">オーナーのみ</span>
                      ) : (
                        <input type="checkbox" className="accent-neon-violet w-4 h-4"
                          checked={Boolean(data.table[r.key]?.[f.key])}
                          onChange={e => toggle(r.key, f.key, e.target.checked)}
                          aria-label={`${r.label}に${f.label}を許可`} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="font-bold text-star-300">店長を招待</h2>
        <p className="text-xs text-white/50">
          キャストマスタに載っている人はキャストマスタの「招待」から（そのとき店長かキャストかを選べます）。
          マスタに無い店長はここからメールで招待します。
        </p>
        <form onSubmit={inviteManager} className="flex gap-2 flex-wrap">
          <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="manager@example.com" className="input-field flex-1 min-w-[220px]" />
          <button type="submit" disabled={inviting} className="btn-primary text-sm">{inviting ? "送信中..." : "店長として招待"}</button>
        </form>
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="font-bold text-star-300">スタッフ一覧</h2>
        <table className="w-full text-sm" data-testid="staff-table">
          <thead>
            <tr className="text-white/50 text-xs border-b border-white/10">
              <th className="text-left px-3 py-2">ロール</th>
              <th className="text-left px-3 py-2">メール</th>
              <th className="text-left px-3 py-2">キャスト</th>
              <th className="text-left px-3 py-2">登録日</th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map(s => (
              <tr key={s.id} className="border-b border-white/5">
                <td className="px-3 py-2"><span className="text-[11px] px-2 py-0.5 rounded-full border border-neon-violet/50 text-neon-violet">{s.roleLabel}</span></td>
                <td className="px-3 py-2">{s.email}</td>
                <td className="px-3 py-2 text-white/70">{s.cast ? `${s.cast.name}（${s.cast.castCode}）` : "—"}</td>
                <td className="px-3 py-2 text-white/40 text-xs">{new Date(s.createdAt).toLocaleDateString("ja-JP")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
