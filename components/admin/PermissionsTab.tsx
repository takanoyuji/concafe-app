"use client";

import { useEffect, useState } from "react";

/**
 * 権限管理（OWNER だけ）。機能 × ロール（店長 / キャスト）の可否を1マスずつ切り替える。
 * OWNER は常に全部可で表に出さない。「権限管理」の行はオーナー固定。
 * 店長の招待（キャストマスタに無い人）もここから
 */
interface Feature { key: string; label: string; icon: string; description: string; ownerOnly?: boolean }
interface Staff {
  id: string; email: string; name: string | null; role: string; roleLabel: string;
  cast: { name: string; castCode: string } | null; createdAt: string;
  status: "invited" | "expired" | "active" | "disabled";
  invitedAt: string | null; invitedBy: string; initialPasswordExpiresAt: string | null; lastLoginAt: string | null; disabledAt: string | null;
}
interface OldToken { id: string; email: string; role: string; cast: { name: string; castCode: string } | null; expiresAt: string; createdAt: string }
interface Resp { features: Feature[]; table: Record<string, Record<string, boolean>>; staff: Staff[] }

const STATUS_LABEL: Record<Staff["status"], { label: string; cls: string }> = {
  invited:  { label: "未ログイン（初期PW）", cls: "text-amber-200 border-amber-400/50" },
  expired:  { label: "期限切れ（要再発行）", cls: "text-neon-pink border-neon-pink/50" },
  active:   { label: "有効", cls: "text-green-300 border-green-400/50" },
  disabled: { label: "停止中", cls: "text-white/40 border-white/20" },
};

/** 初期パスワードは1回しか出ない。コピーできる prompt で見せる（メールには載っていない） */
export function showInitialPassword(email: string, password: string, expiresAt: string) {
  const until = new Date(expiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  prompt(
    `初期パスワード（この画面を閉じると二度と表示されません。本人にはLINEか口頭で渡してください。メールには載っていません）\n` +
    `ログインID: ${email}\n有効期限: ${until} までに初回ログイン`,
    password
  );
}

const ROLES: { key: "MANAGER" | "CAST"; label: string }[] = [{ key: "MANAGER", label: "店長" }, { key: "CAST", label: "キャスト" }];

export default function PermissionsTab({ flash }: { flash: (m: string, isErr?: boolean) => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteEmailConfirm, setInviteEmailConfirm] = useState("");
  const [inviting, setInviting] = useState(false);
  const [oldTokens, setOldTokens] = useState<OldToken[]>([]);

  const load = () =>
    Promise.all([
      fetch("/api/admin/permissions").then(async r => { const d = await r.json(); if (r.ok) { setData(d); setError(null); } else setError(d.error ?? "取得に失敗しました"); }),
      fetch("/api/admin/permissions/tokens").then(async r => { const d = await r.json(); if (r.ok) setOldTokens(d.tokens ?? []); }),
    ]).catch(() => setError("通信に失敗しました"));
  useEffect(() => { void load(); }, []);

  const staffAction = async (s: Staff, action: "reissue" | "disable" | "enable" | "unlink" | "delete") => {
    const msgs: Record<typeof action, string> = {
      reissue: `${s.email} の初期パスワードを作り直しますか？（古いパスワードは使えなくなり、期限が3日延びます）`,
      disable: `${s.email} を停止しますか？ ログイン中でも管理側・キャスト側の機能が使えなくなります。`,
      enable: `${s.email} の停止を解除しますか？`,
      unlink: `${s.email} をキャスト「${s.cast?.name ?? ""}」から切り離しますか？ 報酬が見えなくなります。アカウント自体は残ります。`,
      delete: `${s.email} のアカウントを削除しますか？（未ログインのため削除できます。招待し直すときは再度招待してください）`,
    };
    if (!confirm(msgs[action])) return;
    const res = await fetch(`/api/admin/permissions/staff/${s.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: action === "delete" ? undefined : JSON.stringify({ action }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { flash(d.error ?? "操作に失敗しました", true); return; }
    if (action === "reissue") showInitialPassword(s.email, d.initialPassword, d.expiresAt);
    else flash("更新しました");
    void load();
  };

  const revokeOldToken = async (t: OldToken) => {
    if (!confirm(`${t.email} への招待リンクを取り消しますか？（リンクは使えなくなります。招待し直すときは新しい方式で）`)) return;
    const res = await fetch(`/api/admin/permissions/tokens?id=${t.id}`, { method: "DELETE" });
    if (!res.ok) { flash("取り消しに失敗しました", true); return; }
    flash("招待リンクを取り消しました");
    void load();
  };

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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, emailConfirm: inviteEmailConfirm }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error ?? "招待に失敗しました", true); return; }
      showInitialPassword(d.email, d.initialPassword, d.expiresAt);
      flash(`${d.email} に店長のログイン案内メールを送りました（パスワードは載せていません）`);
      setInviteEmail(""); setInviteEmailConfirm("");
      void load();
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
          キャストの「報酬」（本人分）は権限に関係なく常に見られます。キャスト別売上は既定でオーナーのみです。
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
          マスタに無い店長はここから。招待するとアカウントと<strong className="text-white/80">初期パスワード</strong>が作られ、この画面に1回だけ表示されます。
          メールにはログインIDとURLだけを送り、<strong className="text-white/80">パスワードはLINEか口頭で本人に渡してください</strong>。3日以内に初回ログインが無いと失効します。
        </p>
        <form onSubmit={inviteManager} className="flex gap-2 flex-wrap">
          <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="manager@example.com" className="input-field flex-1 min-w-[220px]" />
          <input type="email" required value={inviteEmailConfirm} onChange={e => setInviteEmailConfirm(e.target.value)} placeholder="確認のためもう一度" className="input-field flex-1 min-w-[220px]" onPaste={e => e.preventDefault()} />
          <button type="submit" disabled={inviting} className="btn-primary text-sm">{inviting ? "作成中..." : "店長として招待"}</button>
        </form>
      </div>

      <div className="glass p-4 space-y-3">
        <h2 className="font-bold text-star-300">スタッフ一覧</h2>
        <p className="text-xs text-white/50">
          間違った相手に招待してしまったら: 未ログインなら「削除」、ログイン済みなら「停止」か「切り離す」。初期パスワードを渡し損ねたら「再発行」。
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="staff-table">
          <thead>
            <tr className="text-white/50 text-xs border-b border-white/10">
              <th className="text-left px-3 py-2">ロール</th>
              <th className="text-left px-3 py-2">メール</th>
              <th className="text-left px-3 py-2">キャスト</th>
              <th className="text-left px-3 py-2">状態</th>
              <th className="text-left px-3 py-2">招待</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map(s => {
              const st = STATUS_LABEL[s.status];
              const isOwner = s.role === "OWNER";
              return (
                <tr key={s.id} className="border-b border-white/5" data-status={s.status}>
                  <td className="px-3 py-2"><span className="text-[11px] px-2 py-0.5 rounded-full border border-neon-violet/50 text-neon-violet">{s.roleLabel}</span></td>
                  <td className="px-3 py-2">{s.email}</td>
                  <td className="px-3 py-2 text-white/70">{s.cast ? `${s.cast.name}（${s.cast.castCode}）` : "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    {s.status === "invited" && s.initialPasswordExpiresAt && <span className="block text-[10px] text-white/40">〜{new Date(s.initialPasswordExpiresAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>}
                    {s.lastLoginAt && <span className="block text-[10px] text-white/40">最終ログイン {new Date(s.lastLoginAt).toLocaleDateString("ja-JP")}</span>}
                  </td>
                  <td className="px-3 py-2 text-white/40 text-xs">{s.invitedAt ? `${new Date(s.invitedAt).toLocaleDateString("ja-JP")} / ${s.invitedBy || "—"}` : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs space-x-2">
                    {!isOwner && (s.status === "invited" || s.status === "expired") && (
                      <>
                        <button onClick={() => staffAction(s, "reissue")} className="text-neon-violet hover:text-neon-purple">再発行</button>
                        <button onClick={() => staffAction(s, "delete")} className="text-neon-pink/70 hover:text-neon-pink">削除</button>
                      </>
                    )}
                    {!isOwner && s.status === "active" && <button onClick={() => staffAction(s, "disable")} className="text-neon-pink/70 hover:text-neon-pink">停止</button>}
                    {!isOwner && s.status === "disabled" && <button onClick={() => staffAction(s, "enable")} className="text-green-300 hover:text-green-200">再開</button>}
                    {!isOwner && s.cast && <button onClick={() => staffAction(s, "unlink")} className="text-white/50 hover:text-white">切り離す</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {oldTokens.length > 0 && (
        <div className="glass p-4 space-y-3 border border-amber-400/30" data-testid="old-invites">
          <h2 className="font-bold text-amber-200">以前の方式（リンクで受諾）の未使用の招待</h2>
          <p className="text-xs text-white/50">
            リンクを開いた人がそのままアカウントを作れます。送り先に間違いが無ければそのままで構いません。不安なら取り消して、新しい方式で招待し直してください。
          </p>
          <table className="w-full text-sm">
            <tbody>
              {oldTokens.map(t => (
                <tr key={t.id} className="border-b border-white/5">
                  <td className="px-3 py-2">{t.email}</td>
                  <td className="px-3 py-2 text-white/70">{t.cast ? `${t.cast.name}（${t.cast.castCode}）` : t.role}</td>
                  <td className="px-3 py-2 text-white/40 text-xs">〜{new Date(t.expiresAt).toLocaleDateString("ja-JP")}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => revokeOldToken(t)} className="text-xs text-neon-pink/70 hover:text-neon-pink">取り消す</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="hidden">
      </div>
    </div>
  );
}
