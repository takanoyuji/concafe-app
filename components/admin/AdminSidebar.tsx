"use client";

import Link from "next/link";

/**
 * 管理画面のサイドバー（PC）。使える機能だけ並べる（/api/auth/me の features）。
 * 予約台帳と権限管理は専用ページ／タブ。項目の可否はサーバー側でも判定している（ここは見た目だけ）
 */
export interface SidebarItem { key: string; label: string; icon: string; href: string }

export const ADMIN_ITEMS: { feature: string; key: string; label: string; icon: string; href: string }[] = [
  { feature: "cast",         key: "cast",        label: "キャスト",     icon: "👤", href: "/admin?tab=cast" },
  { feature: "salary",       key: "salary",      label: "給与計算",     icon: "💴", href: "/admin?tab=salary" },
  { feature: "store_sales",  key: "sales",       label: "売上",         icon: "📈", href: "/admin?tab=sales" },
  { feature: "cast_sales",   key: "castSales",   label: "キャスト売上", icon: "🏅", href: "/admin?tab=castSales" },
  { feature: "points",       key: "points",      label: "ポイント付与", icon: "⭐", href: "/admin?tab=points" },
  { feature: "titles",       key: "titles",      label: "称号マスタ",   icon: "🏆", href: "/admin?tab=titles" },
  { feature: "menu",         key: "menu",        label: "メニュー",     icon: "🍽️", href: "/admin?tab=menu" },
  { feature: "resets",       key: "resets",      label: "リセット履歴", icon: "🔄", href: "/admin?tab=resets" },
  { feature: "reservations", key: "reservations", label: "予約台帳",    icon: "📖", href: "/admin/reservations" },
  { feature: "permissions",  key: "permissions", label: "権限管理",     icon: "🔐", href: "/admin?tab=permissions" },
];

export function itemsFor(features: string[]) {
  return ADMIN_ITEMS.filter(i => features.includes(i.feature));
}

export default function AdminSidebar({
  features, current, roleLabel, onSelect,
}: {
  features: string[];
  current: string;
  roleLabel?: string | null;
  /** 同じページ内のタブ切替。無ければリンク遷移 */
  onSelect?: (key: string) => void;
}) {
  const items = itemsFor(features);
  return (
    <nav className="hidden md:block w-52 shrink-0" data-testid="admin-sidebar" aria-label="管理メニュー">
      <div className="sticky top-24 glass p-3 space-y-1">
        <div className="px-2 pb-2 mb-1 border-b border-white/10">
          <p className="text-xs text-white/50">管理画面</p>
          {roleLabel && <p className="text-[11px] text-neon-violet mt-0.5" data-testid="role-badge">{roleLabel}</p>}
        </div>
        {items.map(i => {
          const active = i.key === current;
          const cls = `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-neon-violet text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`;
          const isTab = i.href.startsWith("/admin?tab=");
          if (onSelect && isTab) {
            return (
              <button key={i.key} onClick={() => onSelect(i.key)} className={`${cls} w-full text-left`} aria-current={active ? "page" : undefined}>
                <span aria-hidden="true">{i.icon}</span>{i.label}
              </button>
            );
          }
          return (
            <Link key={i.key} href={i.href} className={cls} aria-current={active ? "page" : undefined}>
              <span aria-hidden="true">{i.icon}</span>{i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
