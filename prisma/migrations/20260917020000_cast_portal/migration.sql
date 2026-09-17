-- キャストポータル（docs/cast-portal-requirements.md）2026-09-17
ALTER TABLE "Cast" ADD COLUMN "userId" TEXT;
CREATE UNIQUE INDEX "Cast_userId_key" ON "Cast"("userId");

ALTER TABLE "SalaryPeriod" ADD COLUMN "finalizedAt" DATETIME;
ALTER TABLE "SalaryPeriod" ADD COLUMN "finalizedByUserId" TEXT;

CREATE TABLE "SalaryPeriodLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryPeriodLog_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalaryPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SalaryPeriodLog_periodId_idx" ON "SalaryPeriodLog"("periodId");

CREATE TABLE "CastInviteToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CastInviteToken_castId_fkey" FOREIGN KEY ("castId") REFERENCES "Cast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CastInviteToken_tokenHash_key" ON "CastInviteToken"("tokenHash");
CREATE INDEX "CastInviteToken_castId_idx" ON "CastInviteToken"("castId");

-- 保存レコードにキャストコードを持つ（本人の行を名前でなくコードで引く）
ALTER TABLE "SalaryCastRecord" ADD COLUMN "castCode" TEXT NOT NULL DEFAULT '';
