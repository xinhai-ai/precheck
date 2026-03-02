-- AlterTable
ALTER TABLE "SiteSettings"
ADD COLUMN "preApplicationEssayMinLength" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "preApplicationEssayMaxLength" INTEGER NOT NULL DEFAULT 300;
