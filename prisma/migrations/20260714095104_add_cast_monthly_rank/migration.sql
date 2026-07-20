-- CreateTable
CREATE TABLE "CastMonthlyRank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castMasterId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastMonthlyRank_castMasterId_fkey" FOREIGN KEY ("castMasterId") REFERENCES "CastMaster" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CastMonthlyRank_castMasterId_year_month_key" ON "CastMonthlyRank"("castMasterId", "year", "month");
