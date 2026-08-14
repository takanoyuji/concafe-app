-- キャストの2テーブル（Cast / CastMaster）を Cast に統合する
--
-- Cast を土台にして CastMaster を合流させる。逆向きにはできない。
-- Cast.id はポイント履歴とユーザーのお気に入りから参照されており、
-- 振り直すとその紐付けが全て切れるため、既存の id をそのまま維持する。
--
-- 突き合わせは名前（Cast.name = CastMaster.hpName）で行う。
-- 事前に本番のコピーで検証し、対応表を docs/cast-merge-plan.csv として確認済み。

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ===== 1. 統合後の Cast =====
CREATE TABLE "new_Cast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castCode" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "rank" TEXT NOT NULL DEFAULT '',
    "airShiftName" TEXT,
    "exemptFromCommuteRule" BOOLEAN NOT NULL DEFAULT false,
    "tokyoAirRegi" TEXT NOT NULL DEFAULT '',
    "tokyoAirShift" TEXT NOT NULL DEFAULT '',
    "osakaAirRegi" TEXT NOT NULL DEFAULT '',
    "osakaAirShift" TEXT NOT NULL DEFAULT '',
    "nagoyaAirRegi" TEXT NOT NULL DEFAULT '',
    "nagoyaAirShift" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- (a) 両方に存在する（名前が一致する）… Cast の id を維持して給与側を合流
INSERT INTO "new_Cast"
SELECT
    c."id",
    m."castCode",
    c."name",
    c."isPublished",
    m."retired",
    c."bio", c."imageUrl", c."twitterUrl", c."instagramUrl", c."tiktokUrl",
    c."order",
    COALESCE(NULLIF(TRIM(c."rank"), ''), NULLIF(TRIM(m."rank"), ''), ''),
    c."airShiftName", c."exemptFromCommuteRule",
    m."tokyoAirRegi", m."tokyoAirShift", m."osakaAirRegi", m."osakaAirShift",
    m."nagoyaAirRegi", m."nagoyaAirShift",
    c."createdAt", c."updatedAt"
FROM "Cast" c
JOIN "CastMaster" m ON m."hpName" = c."name";

-- (b) 給与マスタにしかいない … HP非表示として取り込む
INSERT INTO "new_Cast"
SELECT
    'mig_' || m."id",
    m."castCode",
    m."hpName",
    false,
    m."retired",
    '', '', NULL, NULL, NULL,
    0,
    COALESCE(TRIM(m."rank"), ''),
    NULL, false,
    m."tokyoAirRegi", m."tokyoAirShift", m."osakaAirRegi", m."osakaAirShift",
    m."nagoyaAirRegi", m."nagoyaAirShift",
    m."createdAt", m."updatedAt"
FROM "CastMaster" m
WHERE TRIM(m."hpName") <> ''
  AND NOT EXISTS (SELECT 1 FROM "Cast" c WHERE c."name" = m."hpName");

-- (c) HPにしかいない … castCode を既存の続きから採番する
INSERT INTO "new_Cast"
SELECT
    c."id",
    'C' || printf('%04d',
        (SELECT COALESCE(MAX(CAST(substr("castCode", 2) AS INTEGER)), 0) FROM "CastMaster")
        + ROW_NUMBER() OVER (ORDER BY c."createdAt", c."id")),
    c."name",
    c."isPublished",
    false,
    c."bio", c."imageUrl", c."twitterUrl", c."instagramUrl", c."tiktokUrl",
    c."order",
    COALESCE(TRIM(c."rank"), ''),
    c."airShiftName", c."exemptFromCommuteRule",
    '', '', '', '', '', '',
    c."createdAt", c."updatedAt"
FROM "Cast" c
WHERE NOT EXISTS (SELECT 1 FROM "CastMaster" m WHERE m."hpName" = c."name");

-- ===== 2. 所属店舗 =====
CREATE TABLE "CastStore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CastStore_castId_fkey" FOREIGN KEY ("castId") REFERENCES "new_Cast" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CastStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- (a) 給与側のエアレジ名・エアシフト名が入っている店舗を所属とみなす
INSERT INTO "CastStore" ("id", "castId", "storeId", "isPrimary", "order")
SELECT lower(hex(randomblob(16))), nc."id", s."id", false, 0
FROM "new_Cast" nc
JOIN "Store" s
WHERE (s."slug" = 'tokyo'  AND (TRIM(nc."tokyoAirRegi")  <> '' OR TRIM(nc."tokyoAirShift")  <> ''))
   OR (s."slug" = 'osaka'  AND (TRIM(nc."osakaAirRegi")  <> '' OR TRIM(nc."osakaAirShift")  <> ''))
   OR (s."slug" = 'nagoya' AND (TRIM(nc."nagoyaAirRegi") <> '' OR TRIM(nc."nagoyaAirShift") <> ''));

-- (b) HP側の店舗紐付けで、(a) に無い組み合わせを補う
INSERT INTO "CastStore" ("id", "castId", "storeId", "isPrimary", "order")
SELECT lower(hex(randomblob(16))), c."id", c."storeId", false, 0
FROM "Cast" c
WHERE EXISTS (SELECT 1 FROM "new_Cast" nc WHERE nc."id" = c."id")
  AND NOT EXISTS (
    SELECT 1 FROM "CastStore" cs WHERE cs."castId" = c."id" AND cs."storeId" = c."storeId"
  );

-- (c) HPに出ている店舗を主たる店舗にする
UPDATE "CastStore"
SET "isPrimary" = true
WHERE EXISTS (
  SELECT 1 FROM "Cast" c
  WHERE c."id" = "CastStore"."castId" AND c."storeId" = "CastStore"."storeId"
);

-- (d) HPに出ていないキャストは、所属が1店舗だけならそこを主たる店舗にする
UPDATE "CastStore"
SET "isPrimary" = true
WHERE "isPrimary" = false
  AND "castId" IN (
    SELECT "castId" FROM "CastStore" GROUP BY "castId"
    HAVING COUNT(*) = 1 AND MAX("isPrimary") = 0
  );

-- ===== 3. 月次ランクの参照先を Cast に付け替える =====
CREATE TABLE "new_CastMonthlyRank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "castId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastMonthlyRank_castId_fkey" FOREIGN KEY ("castId") REFERENCES "new_Cast" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- castMasterId から castCode をたどって、統合後の Cast に付け替える
INSERT INTO "new_CastMonthlyRank"
SELECT r."id", nc."id", r."year", r."month", r."rank", r."createdAt", r."updatedAt"
FROM "CastMonthlyRank" r
JOIN "CastMaster" m ON m."id" = r."castMasterId"
JOIN "new_Cast" nc ON nc."castCode" = m."castCode";

-- ===== 4. 差し替え =====
DROP TABLE "CastMonthlyRank";
ALTER TABLE "new_CastMonthlyRank" RENAME TO "CastMonthlyRank";
CREATE UNIQUE INDEX "CastMonthlyRank_castId_year_month_key" ON "CastMonthlyRank"("castId", "year", "month");

DROP TABLE "CastMaster";
DROP TABLE "Cast";
ALTER TABLE "new_Cast" RENAME TO "Cast";
CREATE UNIQUE INDEX "Cast_castCode_key" ON "Cast"("castCode");
CREATE INDEX "Cast_isPublished_retired_idx" ON "Cast"("isPublished", "retired");

CREATE UNIQUE INDEX "CastStore_castId_storeId_key" ON "CastStore"("castId", "storeId");
CREATE INDEX "CastStore_storeId_isPrimary_idx" ON "CastStore"("storeId", "isPrimary");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
