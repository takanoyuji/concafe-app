-- Airレジ API から取り込んだ取引明細を保持するテーブルを追加する。
--
-- 原本は生JSON（サーバーの /opt/apps/concafe-app/airregi-raw/）。ここに入るのは
-- 集計に使う項目だけの写し。取り込みは営業日単位で「まるごと削除 → 入れ直し」する。
--
-- Store への列追加はテーブル再作成を行わない（CastStore からの外部キー参照があるため、
-- ADD COLUMN で足す）。20260813000000_add_cast_code と同じ方針。

-- 1. 取引ヘッダ
CREATE TABLE "AirRegiTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeNo" TEXT NOT NULL,
    "storeSlug" TEXT NOT NULL,
    "airRegiTransactionId" TEXT NOT NULL,
    -- 0:会計 1:返品。返品も totalAmount がプラス値で返るので、集計時に減算すること
    "transactionType" TEXT NOT NULL,
    "canceledFlg" TEXT NOT NULL DEFAULT '0',
    -- 店舗の業務日付を加味した営業日。期間の切り出しは必ずこれで行う
    "businessDate" TEXT NOT NULL,
    "transactionDateTime" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL DEFAULT '',
    "totalAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    -- 全体割引の合計（割引はマイナス値）。伝票単位なので商品明細には按分できない
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" DATETIME NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 注文明細（Airレジのバリエーション単位で1行）
CREATE TABLE "AirRegiOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL DEFAULT '',
    -- 星狼ではここにキャスト名が入る（遠隔は "遠隔_" 接頭辞つき）
    "categoryName" TEXT NOT NULL DEFAULT '',
    "variationName1" TEXT NOT NULL DEFAULT '',
    "variationName2" TEXT NOT NULL DEFAULT '',
    "orderCount" INTEGER NOT NULL,
    "discountedPrice" INTEGER NOT NULL,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    -- 0:内税 1:外税
    "taxType" TEXT NOT NULL DEFAULT '0',
    "taxRate" TEXT NOT NULL DEFAULT '',
    -- 1個あたりの原価。未設定商品は0が返る（TC・飲み放題・入場料などが該当）
    "cost" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AirRegiOrder_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "AirRegiTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. 支払方法別の内訳。給与計算では使わない。Airペイの実効料率の定点観測用
CREATE TABLE "AirRegiPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "paymentMethodName" TEXT NOT NULL,
    -- 000:現金 050:外部連携決済(Airペイ等) 101:商品券 102:売掛金
    "paymentType" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "AirRegiPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "AirRegiTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. 営業日ごとの取り込み台帳。「取れていない営業日」を管理画面に出すために使う
CREATE TABLE "AirRegiSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeSlug" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL DEFAULT '',
    -- 生JSON側の取得日時。ファイルがこれより新しければ取り込み直す
    "fetchedAt" DATETIME NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Store に Airレジの店舗番号を足す。
--    取り込み時に生JSONの storeNo と照合し、一致しなければ取り込まない。
--    別店舗のデータを取り込む事故をデータ層で止めるためのもの。
ALTER TABLE "Store" ADD COLUMN "airRegiStoreNo" TEXT NOT NULL DEFAULT '';

-- 6. 実際の店舗番号を入れる（2026-09-01 の初回バックフィルで判明した値）
UPDATE "Store" SET "airRegiStoreNo" = 'AKR6612359648' WHERE "slug" = 'tokyo';
UPDATE "Store" SET "airRegiStoreNo" = 'AKR9807318054' WHERE "slug" = 'osaka';
UPDATE "Store" SET "airRegiStoreNo" = 'AKR9839769627' WHERE "slug" = 'nagoya';

-- インデックス
CREATE INDEX "AirRegiTransaction_storeSlug_businessDate_idx" ON "AirRegiTransaction"("storeSlug", "businessDate");
CREATE UNIQUE INDEX "AirRegiTransaction_storeNo_airRegiTransactionId_key" ON "AirRegiTransaction"("storeNo", "airRegiTransactionId");
CREATE INDEX "AirRegiOrder_transactionId_idx" ON "AirRegiOrder"("transactionId");
CREATE INDEX "AirRegiPayment_transactionId_idx" ON "AirRegiPayment"("transactionId");
CREATE INDEX "AirRegiSyncLog_businessDate_idx" ON "AirRegiSyncLog"("businessDate");
CREATE UNIQUE INDEX "AirRegiSyncLog_storeSlug_businessDate_key" ON "AirRegiSyncLog"("storeSlug", "businessDate");
