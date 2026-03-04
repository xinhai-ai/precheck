ALTER TABLE "SiteSettings"
  ADD COLUMN "preApplicationDailyGlobalLimit" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "preApplicationDailyUserLimit" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "preApplicationSubmitStartTime" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN "preApplicationSubmitEndTime" TEXT NOT NULL DEFAULT '21:00';
