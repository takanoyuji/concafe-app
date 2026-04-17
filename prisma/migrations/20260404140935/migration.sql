/*
  Warnings:

  - You are about to drop the column `instagramUrl` on the `Cast` table. All the data in the column will be lost.
  - You are about to drop the column `tiktokUrl` on the `Cast` table. All the data in the column will be lost.
  - You are about to alter the column `favoriteCastIds` on the `User` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "twitterUrl" TEXT,
    "youtubeUrl" TEXT,
    "streamUrl" TEXT,
    "remoteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "unmannedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Cast" ("bio", "createdAt", "id", "imageUrl", "name", "order", "remoteEnabled", "streamUrl", "twitterUrl", "unmannedEnabled", "updatedAt", "youtubeUrl") SELECT "bio", "createdAt", "id", "imageUrl", "name", "order", "remoteEnabled", "streamUrl", "twitterUrl", "unmannedEnabled", "updatedAt", "youtubeUrl" FROM "Cast";
DROP TABLE "Cast";
ALTER TABLE "new_Cast" RENAME TO "Cast";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "favoriteCastIds" JSONB NOT NULL DEFAULT [],
    "favoriteStoreId" TEXT,
    "favoriteCast1Id" TEXT,
    "favoriteCast2Id" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "favoriteCast1Id", "favoriteCast2Id", "favoriteCastIds", "favoriteStoreId", "id", "mustChangePassword", "name", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "emailVerified", "favoriteCast1Id", "favoriteCast2Id", "favoriteCastIds", "favoriteStoreId", "id", "mustChangePassword", "name", "passwordHash", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
