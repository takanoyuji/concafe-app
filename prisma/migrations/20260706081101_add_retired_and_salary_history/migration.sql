-- CreateTable
CREATE TABLE "SalaryPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "half" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalaryCastRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "castName" TEXT NOT NULL,
    "hpName" TEXT NOT NULL DEFAULT '',
    "rank" TEXT NOT NULL DEFAULT '',
    "basicPay" REAL NOT NULL DEFAULT 0,
    "commute" REAL NOT NULL DEFAULT 0,
    "back" REAL NOT NULL DEFAULT 0,
    "payment" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "totalSales" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "SalaryCastRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalaryPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SalarySummaryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "totalSalesTaxIncl" REAL NOT NULL DEFAULT 0,
    "remoteSales" REAL NOT NULL DEFAULT 0,
    "localSales" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "castPay" REAL NOT NULL DEFAULT 0,
    "laborCost" REAL NOT NULL DEFAULT 0,
    "contributionProfit" REAL NOT NULL DEFAULT 0,
    "workHours" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SalarySummaryRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalaryPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CastMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hpName" TEXT NOT NULL DEFAULT '',
    "rank" TEXT NOT NULL DEFAULT '',
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "tokyoAirRegi" TEXT NOT NULL DEFAULT '',
    "tokyoAirShift" TEXT NOT NULL DEFAULT '',
    "osakaAirRegi" TEXT NOT NULL DEFAULT '',
    "osakaAirShift" TEXT NOT NULL DEFAULT '',
    "nagoyaAirRegi" TEXT NOT NULL DEFAULT '',
    "nagoyaAirShift" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CastMaster" ("createdAt", "hpName", "id", "nagoyaAirRegi", "nagoyaAirShift", "osakaAirRegi", "osakaAirShift", "rank", "tokyoAirRegi", "tokyoAirShift", "updatedAt") SELECT "createdAt", "hpName", "id", "nagoyaAirRegi", "nagoyaAirShift", "osakaAirRegi", "osakaAirShift", "rank", "tokyoAirRegi", "tokyoAirShift", "updatedAt" FROM "CastMaster";
DROP TABLE "CastMaster";
ALTER TABLE "new_CastMaster" RENAME TO "CastMaster";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPeriod_storeName_year_month_half_key" ON "SalaryPeriod"("storeName", "year", "month", "half");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySummaryRecord_periodId_key" ON "SalarySummaryRecord"("periodId");
