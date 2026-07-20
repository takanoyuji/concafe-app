-- CreateTable
CREATE TABLE "CastMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hpName" TEXT NOT NULL DEFAULT '',
    "rank" TEXT NOT NULL DEFAULT '',
    "tokyoAirRegi" TEXT NOT NULL DEFAULT '',
    "tokyoAirShift" TEXT NOT NULL DEFAULT '',
    "osakaAirRegi" TEXT NOT NULL DEFAULT '',
    "osakaAirShift" TEXT NOT NULL DEFAULT '',
    "nagoyaAirRegi" TEXT NOT NULL DEFAULT '',
    "nagoyaAirShift" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
