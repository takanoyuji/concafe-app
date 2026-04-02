-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "remoteEnabled" BOOLEAN NOT NULL DEFAULT false,
    "unmannedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Cast" ("bio","createdAt","id","imageUrl","instagramUrl","name","order","remoteEnabled","tiktokUrl","twitterUrl","unmannedEnabled","updatedAt")
    SELECT "bio","createdAt","id","imageUrl","instagramUrl","name","order","remoteEnabled","tiktokUrl","twitterUrl","unmannedEnabled","updatedAt" FROM "Cast";
DROP TABLE "Cast";
ALTER TABLE "new_Cast" RENAME TO "Cast";
PRAGMA foreign_keys=ON;
