ALTER TABLE "FingerprintEvent"
ADD COLUMN "browserFamily" TEXT,
ADD COLUMN "networkKey" TEXT;

CREATE INDEX "FingerprintEvent_browserFamily_createdAt_idx"
ON "FingerprintEvent"("browserFamily", "createdAt");

CREATE INDEX "FingerprintEvent_networkKey_createdAt_idx"
ON "FingerprintEvent"("networkKey", "createdAt");
