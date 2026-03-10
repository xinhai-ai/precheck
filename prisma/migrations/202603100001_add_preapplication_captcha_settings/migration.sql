ALTER TABLE "SiteSettings"
  ADD COLUMN "preApplicationCaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preApplicationCaptchaProvider" TEXT;
