import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { normalizeRole, can, allowedFeatures, canAccessAdmin, isStaffRole, clearPermissionCache, FEATURES, ROLE_LABEL } from "@/lib/permissions";

beforeEach(async () => { await prisma.rolePermission.deleteMany(); clearPermissionCache(); });
afterAll(async () => { await prisma.rolePermission.deleteMany(); await prisma.$disconnect(); });

describe("ロール", () => {
  it("旧 ADMIN は OWNER として読む。不明な値は CUSTOMER", () => {
    expect(normalizeRole("ADMIN")).toBe("OWNER");
    expect(normalizeRole("OWNER")).toBe("OWNER");
    expect(normalizeRole("MANAGER")).toBe("MANAGER");
    expect(normalizeRole("CAST")).toBe("CAST");
    expect(normalizeRole("CUSTOMER")).toBe("CUSTOMER");
    expect(normalizeRole("nope")).toBe("CUSTOMER");
    expect(normalizeRole(null)).toBe("CUSTOMER");
  });
  it("管理画面に入れるのは OWNER / MANAGER（旧 ADMIN 含む）。客にはロールのラベルが無い", () => {
    expect(canAccessAdmin("ADMIN")).toBe(true);
    expect(canAccessAdmin("MANAGER")).toBe(true);
    expect(canAccessAdmin("CAST")).toBe(false);
    expect(canAccessAdmin("CUSTOMER")).toBe(false);
    expect(isStaffRole("CUSTOMER")).toBe(false);
    expect(ROLE_LABEL.CUSTOMER).toBe("");
    expect(ROLE_LABEL.MANAGER).toBe("店長");
  });
});

describe("機能 × ロールの既定", () => {
  it("OWNER は全部。MANAGER は権限管理とキャスト売上以外全部。CAST と CUSTOMER は無し（キャスト別売上はオーナーのみ）", async () => {
    for (const f of FEATURES) expect(await can("OWNER", f.key)).toBe(true);
    expect(await allowedFeatures("MANAGER")).toEqual(FEATURES.filter(f => f.key !== "permissions" && f.key !== "cast_sales").map(f => f.key));
    expect(await allowedFeatures("CAST")).toEqual([]);
    expect(await allowedFeatures("CUSTOMER")).toEqual([]);
    expect(await can("CAST", "cast_sales")).toBe(false);
    expect(await can("MANAGER", "cast_sales")).toBe(false);
  });

  it("権限管理の上書きが効く。OWNER と『権限管理』の行は変えられない", async () => {
    await prisma.rolePermission.create({ data: { role: "CAST", feature: "cast_sales", allowed: true } });
    await prisma.rolePermission.create({ data: { role: "MANAGER", feature: "salary", allowed: false } });
    await prisma.rolePermission.create({ data: { role: "CAST", feature: "store_sales", allowed: true } });
    await prisma.rolePermission.create({ data: { role: "MANAGER", feature: "permissions", allowed: true } }); // 無視される
    clearPermissionCache();
    expect(await can("CAST", "cast_sales")).toBe(true);
    expect(await can("CAST", "store_sales")).toBe(true);
    expect(await can("MANAGER", "salary")).toBe(false);
    expect(await can("MANAGER", "permissions")).toBe(false);
    expect(await can("OWNER", "salary")).toBe(true);
  });

  it("表は60秒キャッシュされ、clearPermissionCache で捨てる", async () => {
    expect(await can("MANAGER", "menu")).toBe(true);
    await prisma.rolePermission.create({ data: { role: "MANAGER", feature: "menu", allowed: false } });
    expect(await can("MANAGER", "menu")).toBe(true); // まだキャッシュ
    clearPermissionCache();
    expect(await can("MANAGER", "menu")).toBe(false);
  });
});
