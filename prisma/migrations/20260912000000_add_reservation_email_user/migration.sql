-- 予約状況の確認（会員のマイページ）とメール通知のための列（要件書 10章・2026-09-12 決定）。
--
-- email : 通知先。受付・確定・お断りのメールを送る。メール認証済みの会員なら
--         この列が会員のメールアドレスと一致する予約をマイページに出す
-- userId: ログイン中に申し込んだ会員の User.id。未ログインの申し込みは空
--
-- 既存行はどちらも空文字（この列ができる前の申し込み）。既存データには触らない。
ALTER TABLE "Reservation" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Reservation" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Reservation_userId_idx" ON "Reservation"("userId");
CREATE INDEX "Reservation_email_idx" ON "Reservation"("email");
