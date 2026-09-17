-- 最低賃金の月間判定に労働時間と給与（丸め前）が要る（2026-09-17）。過去のレコードは0＝不明
ALTER TABLE "SalaryCastRecord" ADD COLUMN "workMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SalaryCastRecord" ADD COLUMN "salary" REAL NOT NULL DEFAULT 0;
