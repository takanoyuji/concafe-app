-- 業績サマリに全体割引の総額を持たせる。
--
-- 「割引後が正しい」という判断（2026-09-02）に合わせ、Airレジ API から計算した
-- 業績サマリは全体割引を適用後の数字にする。何をいくら引いたかを後から確認できるよう、
-- 総額そのものを列で残す。
--
-- 既存行は 0（CSVから計算されたもので、全体割引は載っていない）。
-- 外部キー参照があるためテーブル再作成はせず ADD COLUMN で足す。
ALTER TABLE "SalarySummaryRecord" ADD COLUMN "orderDiscount" REAL NOT NULL DEFAULT 0;
