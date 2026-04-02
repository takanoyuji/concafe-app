-- AlterTable: add youtubeUrl and streamUrl to Cast
-- Note: instagramUrl and tiktokUrl columns remain in DB but are no longer used by the app
ALTER TABLE "Cast" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "Cast" ADD COLUMN "streamUrl" TEXT;
