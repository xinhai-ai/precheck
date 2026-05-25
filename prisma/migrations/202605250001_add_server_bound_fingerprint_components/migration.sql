-- AlterTable
ALTER TABLE "FingerprintProfile"
ADD COLUMN "fingerprintBasis" JSONB,
ADD COLUMN "componentKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "FingerprintEvent"
ADD COLUMN "fingerprintComponents" JSONB,
ADD COLUMN "fingerprintSummary" JSONB,
ADD COLUMN "similarityScore" INTEGER,
ADD COLUMN "similaritySignals" JSONB;

-- CreateIndex
CREATE INDEX "FingerprintEvent_similarityScore_createdAt_idx"
ON "FingerprintEvent"("similarityScore", "createdAt");
