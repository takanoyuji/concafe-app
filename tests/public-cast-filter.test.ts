import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");

/**
 * 公開側でキャストを引く箇所が PUBLIC_CAST_WHERE を通しているかの静的検査。
 *
 * 経路が7か所に散っているため、新しくキャストを引くコードが増えたときに
 * フィルタを付け忘れても実行するまで気づけない。それをCIで検知する。
 */

// 管理者専用の経路。非公開キャストを扱えて当然なので対象外。
const ADMIN_PATHS = ["app/admin/", "app/api/admin/", "app/api/upload"];

// 個別に判断済みの例外（理由を必ず添える）
const ALLOWLIST: Record<string, string> = {
  "lib/cast.ts": "PUBLIC_CAST_WHERE の定義元",
  "app/api/cast/[id]/route.ts": "管理者は非公開キャストも取得できる必要があるため三項で分岐（GETはフィルタ済み）",
  "app/api/cast/route.ts": "管理者の includeHidden=1 のときだけ undefined にする分岐あり（既定はフィルタ済み）",
  "app/api/sync/cast-master/route.ts": "外部システム向けの同期API。トークン認証済みで、退職者も含めて全件返す必要がある",
  "lib/rank.ts": "給与計算のランク解決。公開ページからは呼ばれない",
};

// キャストをDBから引いているコードの検出パターン
const CAST_QUERY = /prisma\.cast\.(findMany|findFirst|findUnique|count|aggregate)|casts:\s*\{/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function publicSourceFiles(): string[] {
  return ["app", "components", "lib"]
    .flatMap((d) => walk(path.join(ROOT, d)))
    .map((f) => path.relative(ROOT, f))
    .filter((rel) => !ADMIN_PATHS.some((p) => rel.startsWith(p)))
    .filter((rel) => !rel.startsWith("tests/"));
}

describe("公開側のキャスト取得は PUBLIC_CAST_WHERE を通す", () => {
  const offenders = publicSourceFiles().filter((rel) => {
    if (rel in ALLOWLIST) return false;
    const src = fs.readFileSync(path.join(ROOT, rel), "utf-8");
    if (!CAST_QUERY.test(src)) return false;
    return !src.includes("PUBLIC_CAST_WHERE") && !src.includes("isPublishedCast");
  });

  it("フィルタを通していない公開側ファイルが無い", () => {
    expect(offenders).toEqual([]);
  });

  it("検査対象のファイルを実際に拾えている（検査自体が空振りしていない）", () => {
    const checked = publicSourceFiles().filter((rel) =>
      CAST_QUERY.test(fs.readFileSync(path.join(ROOT, rel), "utf-8"))
    );
    // 経路が減った場合も気づけるよう下限を置く
    expect(checked.length).toBeGreaterThanOrEqual(10);
  });

  it("ALLOWLIST のファイルは実在する", () => {
    for (const rel of Object.keys(ALLOWLIST)) {
      expect(fs.existsSync(path.join(ROOT, rel)), `${rel} が存在しない`).toBe(true);
    }
  });
});
