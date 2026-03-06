CREATE TYPE "PreApplicationAppealStatus" AS ENUM ('PENDING', 'REJECTED', 'OVERRIDDEN');

ALTER TABLE "SiteSettings"
ADD COLUMN "preApplicationAppealEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PreApplicationAppeal" (
  "id" TEXT NOT NULL,
  "preApplicationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "PreApplicationAppealStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreApplicationAppeal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PreApplicationAppeal"
  ADD CONSTRAINT "PreApplicationAppeal_preApplicationId_fkey"
  FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAppeal"
  ADD CONSTRAINT "PreApplicationAppeal_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAppeal"
  ADD CONSTRAINT "PreApplicationAppeal_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PreApplicationAppeal_preApplicationId_createdAt_idx"
  ON "PreApplicationAppeal"("preApplicationId", "createdAt");

CREATE UNIQUE INDEX "PreApplicationAppeal_preApplicationId_pending_key"
  ON "PreApplicationAppeal"("preApplicationId")
  WHERE "status" = 'PENDING';

CREATE INDEX "PreApplicationAppeal_userId_createdAt_idx"
  ON "PreApplicationAppeal"("userId", "createdAt");

CREATE INDEX "PreApplicationAppeal_status_createdAt_idx"
  ON "PreApplicationAppeal"("status", "createdAt");
