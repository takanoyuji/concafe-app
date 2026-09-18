/**
 * ロールと権限（2026-09-18）。
 *
 * ロールは4つ。旧 "ADMIN" は OWNER の別名として読む（本番の既存ユーザーと発行済みセッションのため）。
 *
 *   OWNER    … オーナー。全部できる。権限管理と店長の招待はここだけ
 *   MANAGER  … 店長。全店舗共通。既定では権限管理とキャスト別売上以外すべて
 *   CAST     … キャスト本人。自分の報酬は常に見られる。それ以外は既定で不可
 *   CUSTOMER … 客。管理側の機能は無い。ロールの表示もしない
 *
 * 機能ごとの可否は「機能 × ロール」の表で持ち、OWNER が権限管理で MANAGER / CAST の行を切り替える。
 * OWNER の行は固定（常に可）。表に無い組み合わせは DEFAULTS を使う。
 *
 * ⚠️ 判定は必ずサーバー側（API・ページ）で行う。サイドバーで隠すのは見た目だけ。
 */
import { prisma } from "@/lib/prisma";

export type Role = "OWNER" | "MANAGER" | "CAST" | "CUSTOMER";

/** 旧ロール名も受けて正規化する。不明な値は CUSTOMER 扱い（何も開かない側に倒す） */
export function normalizeRole(role: string | null | undefined): Role {
  if (role === "ADMIN" || role === "OWNER") return "OWNER";
  if (role === "MANAGER") return "MANAGER";
  if (role === "CAST") return "CAST";
  return "CUSTOMER";
}

export const ROLE_LABEL: Record<Role, string> = { OWNER: "オーナー", MANAGER: "店長", CAST: "キャスト", CUSTOMER: "" };

/** 管理画面（/admin）に入れるロール */
export function canAccessAdmin(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "OWNER" || r === "MANAGER";
}
/** スタッフ（ロールの表示対象）。客には出さない */
export function isStaffRole(role: string | null | undefined): boolean {
  return normalizeRole(role) !== "CUSTOMER";
}

export type Feature =
  | "cast"          // キャスト管理（マスタ・名前の対応・招待・画像）
  | "salary"        // 給与計算・ランク・Airレジ取込
  | "store_sales"   // 店舗の日次売上
  | "cast_sales"    // キャスト別の月次売上
  | "points"        // ポイント付与・会員一覧
  | "titles"        // 称号マスタ
  | "menu"          // メニュー
  | "resets"        // リセット履歴
  | "reservations"  // 予約台帳
  | "permissions";  // 権限管理・店長の招待（OWNER 固定）

export const FEATURES: { key: Feature; label: string; icon: string; description: string; ownerOnly?: boolean }[] = [
  { key: "cast",         label: "キャスト",     icon: "👤", description: "キャストの表示・マスタ・招待" },
  { key: "salary",       label: "給与計算",     icon: "💴", description: "給与計算・ランク・Airレジ取込・確定" },
  { key: "store_sales",  label: "売上",         icon: "📈", description: "店舗ごとの日次売上（来店 / 遠隔）" },
  { key: "cast_sales",   label: "キャスト売上", icon: "🏅", description: "キャスト別の月次売上（来店 / 遠隔）。既定はオーナーのみ" },
  { key: "points",       label: "ポイント付与", icon: "⭐", description: "会員へのポイント付与" },
  { key: "titles",       label: "称号マスタ",   icon: "🏆", description: "称号の登録・編集" },
  { key: "menu",         label: "メニュー",     icon: "🍽️", description: "メニューの登録・編集" },
  { key: "resets",       label: "リセット履歴", icon: "🔄", description: "月次リセットの履歴" },
  { key: "reservations", label: "予約台帳",     icon: "📖", description: "席予約の承認・お断り" },
  { key: "permissions",  label: "権限管理",     icon: "🔐", description: "ロールごとの権限と店長の招待", ownerOnly: true },
];

/** 既定の可否。権限管理で上書きできるのは MANAGER と CAST の行だけ。
 *  キャスト別売上（cast_sales）は既定でオーナーのみ（2026-09-18 代表判断。他人の売上は見せない） */
const DEFAULTS: Record<Exclude<Role, "OWNER">, Partial<Record<Feature, boolean>>> = {
  MANAGER: {
    cast: true, salary: true, store_sales: true, cast_sales: false, points: true,
    titles: true, menu: true, resets: true, reservations: true, permissions: false,
  },
  CAST: {},
  CUSTOMER: {},
};

export type PermissionTable = Record<Exclude<Role, "OWNER">, Record<Feature, boolean>>;

function defaultTable(): PermissionTable {
  const build = (role: Exclude<Role, "OWNER">) =>
    Object.fromEntries(FEATURES.map(f => [f.key, Boolean(DEFAULTS[role][f.key])])) as Record<Feature, boolean>;
  return { MANAGER: build("MANAGER"), CAST: build("CAST"), CUSTOMER: build("CUSTOMER") };
}

// 60秒のメモリキャッシュ。権限管理で保存したら clearPermissionCache() で捨てる
let cachedTable: { at: number; table: PermissionTable } | null = null;
export function clearPermissionCache() { cachedTable = null; }

/** DB の上書きを既定に重ねた表。OWNER は含めない（常に全部可） */
export async function getPermissionTable(): Promise<PermissionTable> {
  if (cachedTable && Date.now() - cachedTable.at < 60_000) return cachedTable.table;
  const table = defaultTable();
  const rows = await prisma.rolePermission.findMany();
  for (const r of rows) {
    const role = r.role as Exclude<Role, "OWNER">;
    const feature = r.feature as Feature;
    if (role in table && FEATURES.some(f => f.key === feature)) {
      // permissions は OWNER 固定。DB に入っていても無視する
      if (feature === "permissions") continue;
      table[role][feature] = r.allowed;
    }
  }
  cachedTable = { at: Date.now(), table };
  return table;
}

/** そのロールがその機能を使えるか */
export async function can(role: string | null | undefined, feature: Feature): Promise<boolean> {
  const r = normalizeRole(role);
  if (r === "OWNER") return true;
  if (r === "CUSTOMER") return false;
  const table = await getPermissionTable();
  return Boolean(table[r][feature]);
}

/** そのロールが使える機能の一覧（サイドバー用） */
export async function allowedFeatures(role: string | null | undefined): Promise<Feature[]> {
  const out: Feature[] = [];
  for (const f of FEATURES) if (await can(role, f.key)) out.push(f.key);
  return out;
}
