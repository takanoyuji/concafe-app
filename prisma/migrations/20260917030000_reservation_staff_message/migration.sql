-- 予約のステータス変更にお客様へのメッセージを添える（2026-09-17）
ALTER TABLE "Reservation" ADD COLUMN "staffMessage" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ReservationEvent" ADD COLUMN "message" TEXT NOT NULL DEFAULT '';
