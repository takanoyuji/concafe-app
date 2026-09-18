-- ロール4種と権限表（2026-09-18）。旧 ADMIN は OWNER に
UPDATE "User" SET "role" = 'OWNER' WHERE "role" = 'ADMIN';

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "RolePermission_role_feature_key" ON "RolePermission"("role", "feature");

-- 招待: castId を任意にし、ロールを持つ（SQLite は NOT NULL を外せないのでテーブルを作り直す）
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CastInviteToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CAST',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CastInviteToken_castId_fkey" FOREIGN KEY ("castId") REFERENCES "Cast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CastInviteToken" ("id", "castId", "email", "tokenHash", "expiresAt", "usedAt", "createdAt")
  SELECT "id", "castId", "email", "tokenHash", "expiresAt", "usedAt", "createdAt" FROM "CastInviteToken";
DROP TABLE "CastInviteToken";
ALTER TABLE "new_CastInviteToken" RENAME TO "CastInviteToken";
CREATE UNIQUE INDEX "CastInviteToken_tokenHash_key" ON "CastInviteToken"("tokenHash");
CREATE INDEX "CastInviteToken_castId_idx" ON "CastInviteToken"("castId");
PRAGMA foreign_keys=ON;
