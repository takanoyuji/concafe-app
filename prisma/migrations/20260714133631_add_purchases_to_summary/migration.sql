-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalarySummaryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "totalSalesTaxIncl" REAL NOT NULL DEFAULT 0,
    "remoteSales" REAL NOT NULL DEFAULT 0,
    "localSales" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "grossProfit" REAL NOT NULL DEFAULT 0,
    "purchases" REAL NOT NULL DEFAULT 0,
    "castPay" REAL NOT NULL DEFAULT 0,
    "laborCost" REAL NOT NULL DEFAULT 0,
    "contributionProfit" REAL NOT NULL DEFAULT 0,
    "workHours" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "SalarySummaryRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "SalaryPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SalarySummaryRecord" ("castPay", "contributionProfit", "grossProfit", "id", "laborCost", "localSales", "periodId", "remoteSales", "taxAmount", "totalSalesTaxIncl", "workHours") SELECT "castPay", "contributionProfit", "grossProfit", "id", "laborCost", "localSales", "periodId", "remoteSales", "taxAmount", "totalSalesTaxIncl", "workHours" FROM "SalarySummaryRecord";
DROP TABLE "SalarySummaryRecord";
ALTER TABLE "new_SalarySummaryRecord" RENAME TO "SalarySummaryRecord";
CREATE UNIQUE INDEX "SalarySummaryRecord_periodId_key" ON "SalarySummaryRecord"("periodId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
