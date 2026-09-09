-- 席の予約（承認制・第1段階）を追加する。
--
-- 来店日時を DATETIME ではなく TEXT 2列（visitDate / visitTime）で持つのは、
-- サーバーのタイムゾーンがUTCのため。JSTの文字列で入れて文字列のまま出せば、
-- 「18:00 で申し込まれたものが 9:00 で表示される」類の事故が起きない。
-- 並び替えは (visitDate, visitTime) の辞書順で日時順になる。
--
-- 予約は物理削除しない。取りやめも status を変えて残し、変更は ReservationEvent に積む。
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "visitDate" TEXT NOT NULL,
    "visitTime" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'LINE',
    "ipHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastActorId" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Reservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Reservation_visitDate_visitTime_idx" ON "Reservation"("visitDate", "visitTime");
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");
CREATE INDEX "Reservation_phone_createdAt_idx" ON "Reservation"("phone", "createdAt");

CREATE TABLE "ReservationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReservationEvent_reservationId_idx" ON "ReservationEvent"("reservationId");
