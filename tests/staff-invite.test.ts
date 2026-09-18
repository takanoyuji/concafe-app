import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

vi.mock("@/lib/email", () => ({ sendStaffInviteEmail: vi.fn(async () => undefined) }));

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { inviteStaff, reissueInitialPassword, loginBlockReason, generateInitialPassword, INITIAL_PASSWORD_TTL_MS } from "@/lib/staffInvite";
import { sendStaffInviteEmail } from "@/lib/email";

const OWNER = "owner-1";
async function reset() {
  await prisma.cast.updateMany({ data: { userId: null } });
  await prisma.user.deleteMany({ where: { role: { in: ["CAST", "MANAGER"] } } });
  await prisma.cast.deleteMany();
}
beforeEach(reset);
afterAll(async () => { await reset(); await prisma.$disconnect(); });

describe("初期パスワード方式の招待", () => {
  it("アカウントを作り、初期PWを返す。メールにはPWを渡さない。72時間の期限と初回変更必須", async () => {
    const cast = await prisma.cast.create({ data: { castCode: "C0001", name: "サクラ" } });
    const r = await inviteStaff({ email: "Sakura@Example.com", emailConfirm: "sakura@example.com", role: "CAST", castId: cast.id, invitedByUserId: OWNER });
    expect(r.email).toBe("sakura@example.com");
    expect(r.initialPassword).toHaveLength(12);
    expect(r.expiresAt.getTime() - Date.now()).toBeGreaterThan(INITIAL_PASSWORD_TTL_MS - 5000);

    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(u.role).toBe("CAST");
    expect(u.mustChangePassword).toBe(true);
    expect(u.emailVerified).toBe(true);
    expect(u.invitedByUserId).toBe(OWNER);
    expect(await bcrypt.compare(r.initialPassword, u.passwordHash)).toBe(true);
    expect((await prisma.cast.findUniqueOrThrow({ where: { id: cast.id } })).userId).toBe(u.id);

    // メール送信の引数に初期PWが含まれない
    const call = vi.mocked(sendStaffInviteEmail).mock.calls.at(-1)!;
    expect(JSON.stringify(call)).not.toContain(r.initialPassword);
  });

  it("確認用メールが一致しないと作らない。既存メール・退職者・結び済みは拒否", async () => {
    await expect(inviteStaff({ email: "a@example.com", emailConfirm: "b@example.com", role: "CAST", castId: null, invitedByUserId: OWNER })).rejects.toThrow(/一致しません/);
    expect(await prisma.user.count({ where: { email: "a@example.com" } })).toBe(0);

    await inviteStaff({ email: "m@example.com", emailConfirm: "m@example.com", role: "MANAGER", castId: null, invitedByUserId: OWNER });
    await expect(inviteStaff({ email: "m@example.com", emailConfirm: "m@example.com", role: "MANAGER", castId: null, invitedByUserId: OWNER })).rejects.toThrow(/既に登録/);

    const retired = await prisma.cast.create({ data: { castCode: "C0009", name: "退職", retired: true } });
    await expect(inviteStaff({ email: "r@example.com", emailConfirm: "r@example.com", role: "CAST", castId: retired.id, invitedByUserId: OWNER })).rejects.toThrow(/退職/);
  });

  it("再発行は未ログインの人だけ。ログイン済みは拒否", async () => {
    const r = await inviteStaff({ email: "c@example.com", emailConfirm: "c@example.com", role: "CAST", castId: null, invitedByUserId: OWNER });
    const re = await reissueInitialPassword(r.userId);
    expect(re.initialPassword).not.toBe(r.initialPassword);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.userId } });
    expect(await bcrypt.compare(re.initialPassword, u.passwordHash)).toBe(true);
    expect(await bcrypt.compare(r.initialPassword, u.passwordHash)).toBe(false);

    await prisma.user.update({ where: { id: r.userId }, data: { lastLoginAt: new Date() } });
    await expect(reissueInitialPassword(r.userId)).rejects.toThrow(/ログイン済み/);
  });

  it("ログインの拒否: 停止中、初期PWの期限切れ（未ログイン）。期限内・ログイン済みは通す", () => {
    const past = new Date(Date.now() - 1000), future = new Date(Date.now() + 1000);
    expect(loginBlockReason({ role: "CAST", lastLoginAt: null, initialPasswordExpiresAt: past, disabledAt: null })).toMatch(/期限/);
    expect(loginBlockReason({ role: "CAST", lastLoginAt: null, initialPasswordExpiresAt: future, disabledAt: null })).toBeNull();
    expect(loginBlockReason({ role: "CAST", lastLoginAt: new Date(), initialPasswordExpiresAt: past, disabledAt: null })).toBeNull();
    expect(loginBlockReason({ role: "MANAGER", lastLoginAt: new Date(), initialPasswordExpiresAt: null, disabledAt: new Date() })).toMatch(/停止/);
    expect(loginBlockReason({ role: "CUSTOMER", lastLoginAt: null, initialPasswordExpiresAt: null, disabledAt: null })).toBeNull();
  });

  it("初期PWは読み間違えやすい文字を含まない", () => {
    for (let i = 0; i < 50; i++) expect(generateInitialPassword()).not.toMatch(/[0O1lI]/);
  });
});
