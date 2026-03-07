CREATE TYPE "PreApplicationAppealSource" AS ENUM ('USER_APPEAL', 'ADMIN_REVIEW_REQUEST');

ALTER TABLE "SiteSettings"
  ADD COLUMN "preApplicationAppealAutoRejectEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preApplicationAppealAutoRejectPatterns" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "preApplicationAppealAutoRejectApplySubmitBan" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preApplicationAppealAutoRejectSubmitBanDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "PreApplicationAppeal"
  ADD COLUMN "source" "PreApplicationAppealSource",
  ADD COLUMN "initiatedById" TEXT,
  ADD COLUMN "submitBanApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "submitBanDays" INTEGER,
  ADD COLUMN "submitBanUntil" TIMESTAMP(3),
  ADD COLUMN "autoRejected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoRejectedPattern" TEXT;

UPDATE "PreApplicationAppeal"
SET
  "source" = 'USER_APPEAL',
  "initiatedById" = "userId";

ALTER TABLE "PreApplicationAppeal"
  ALTER COLUMN "source" SET NOT NULL,
  ALTER COLUMN "source" SET DEFAULT 'USER_APPEAL',
  ALTER COLUMN "initiatedById" SET NOT NULL;

ALTER TABLE "PreApplicationAppeal"
  ADD CONSTRAINT "PreApplicationAppeal_initiatedById_fkey"
  FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PreApplicationAppeal_initiatedById_createdAt_idx"
  ON "PreApplicationAppeal"("initiatedById", "createdAt");

CREATE INDEX "PreApplicationAppeal_source_createdAt_idx"
  ON "PreApplicationAppeal"("source", "createdAt");
