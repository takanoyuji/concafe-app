-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "remoteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "unmannedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cast_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cast" ("bio", "createdAt", "id", "imageUrl", "instagramUrl", "name", "order", "storeId", "tiktokUrl", "twitterUrl", "updatedAt") SELECT "bio", "createdAt", "id", "imageUrl", "instagramUrl", "name", "order", "storeId", "tiktokUrl", "twitterUrl", "updatedAt" FROM "Cast";
DROP TABLE "Cast";
ALTER TABLE "new_Cast" RENAME TO "Cast";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
