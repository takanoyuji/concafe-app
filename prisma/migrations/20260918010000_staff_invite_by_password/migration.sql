-- 招待を「初期パスワード方式」に（2026-09-18）。初期PWは管理画面に1回だけ出し、メールには載せない
ALTER TABLE "User" ADD COLUMN "invitedByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "invitedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "initialPasswordExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "disabledAt" DATETIME;
