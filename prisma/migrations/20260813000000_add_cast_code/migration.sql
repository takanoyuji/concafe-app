-- CastMaster に不変の castCode を追加する
-- テーブル再作成は行わない（CastMonthlyRank からの外部キー参照があるため、ADD COLUMN で足す）

-- 1. まず DEFAULT '' で列を追加する。既存行があるので、この時点では一意制約を張れない
ALTER TABLE "CastMaster" ADD COLUMN "castCode" TEXT NOT NULL DEFAULT '';

-- 2. 既存行に createdAt 昇順で C0001 形式を採番する
UPDATE "CastMaster"
SET "castCode" = (
  -- printf('%04d') は4桁ゼロ埋め。1万件を超えても桁が自然に伸びるだけで壊れない
  SELECT 'C' || printf('%04d', t."rn")
  FROM (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS "rn"
    FROM "CastMaster"
  ) AS t
  WHERE t."id" = "CastMaster"."id"
);

-- 3. 採番後に一意制約を張る
CREATE UNIQUE INDEX "CastMaster_castCode_key" ON "CastMaster"("castCode");
