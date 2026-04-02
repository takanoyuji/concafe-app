"use client";
import { useState } from "react";

export default function NameEditForm({ initialName }: { initialName: string | null }) {
  const [name, setName] = useState(initialName ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError("名前を入力してください"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const d = await res.json();
      setError(d.error ?? "保存に失敗しました");
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-white/50 text-xs">お名前（ニックネーム）</p>
      {editing ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            placeholder="ニックネームを入力"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[var(--holo-cyan)]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs px-4 py-2"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            onClick={() => { setEditing(false); setName(initialName ?? ""); setError(null); }}
            className="text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            キャンセル
          </button>
        </div>
      ) : (
        <div className="flex gap-3 items-center">
          <p className="text-white font-medium">
            {name || <span className="text-white/30 text-sm">未設定</span>}
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-[var(--holo-cyan)] hover:text-white/70 transition-colors"
          >
            編集
          </button>
          {saved && <span className="text-green-400 text-xs">保存しました</span>}
        </div>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
