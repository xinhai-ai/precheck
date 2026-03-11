ALTER TABLE "SiteSettings"
  ADD COLUMN "newUserAnnouncementEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "newUserAnnouncementContent" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "newUserAnnouncementConfirmText" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "newUserAnnouncementDelaySeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "newUserAnnouncementVersion" INTEGER NOT NULL DEFAULT 1;
