ALTER TABLE "SiteSettings"
ADD COLUMN "allowedAvatarDomains" JSONB NOT NULL DEFAULT '[]';
