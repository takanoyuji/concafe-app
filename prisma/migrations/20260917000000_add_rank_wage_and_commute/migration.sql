-- ランク制度の時給・交通費有無をランクに、通勤手当の日額をキャストに持つ（2026-09-17）
ALTER TABLE "CastRank" ADD COLUMN "hourlyWage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CastRank" ADD COLUMN "commutePaid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Cast" ADD COLUMN "commuteDaily" INTEGER NOT NULL DEFAULT 0;

-- 制度表（代表提供 2026-09-17）。店長は表に無いのでエアシフトの実績 1,500 円・交通費なし（従来の規則どおり）。
-- 内勤は表に無く、エアシフトでは時給0で運用されていたため 0（未設定）のまま。打刻があると計算が止まるので、そのとき決める
UPDATE "CastRank" SET "hourlyWage" = 1500, "commutePaid" = 0 WHERE "name" = '店長';
UPDATE "CastRank" SET "hourlyWage" = 1400, "commutePaid" = 0 WHERE "name" = 'プラチナ';
UPDATE "CastRank" SET "hourlyWage" = 1300, "commutePaid" = 0 WHERE "name" = 'ブラック';
UPDATE "CastRank" SET "hourlyWage" = 1200, "commutePaid" = 0 WHERE "name" = 'ゴールド';
UPDATE "CastRank" SET "hourlyWage" = 1200, "commutePaid" = 1 WHERE "name" = 'シルバー';
UPDATE "CastRank" SET "hourlyWage" = 1100, "commutePaid" = 1 WHERE "name" = 'ブロンズ';
UPDATE "CastRank" SET "hourlyWage" = 1100, "commutePaid" = 1 WHERE "name" = '研修';
