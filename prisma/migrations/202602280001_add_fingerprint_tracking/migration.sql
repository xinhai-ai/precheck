-- CreateEnum
CREATE TYPE "FingerprintStatus" AS ENUM ('OK', 'COLLECTION_FAILED');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "latestFingerprintAt" TIMESTAMP(3),
ADD COLUMN "latestFingerprintHash" TEXT;

-- AlterTable
ALTER TABLE "PreApplication"
ADD COLUMN "fingerprintCollectedAt" TIMESTAMP(3),
ADD COLUMN "fingerprintHash" TEXT,
ADD COLUMN "fingerprintStatus" "FingerprintStatus" NOT NULL DEFAULT 'COLLECTION_FAILED';

-- CreateTable
CREATE TABLE "FingerprintProfile" (
    "id" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintEvent" (
    "id" TEXT NOT NULL,
    "fingerprintId" TEXT,
    "fingerprintHash" TEXT,
    "eventType" TEXT NOT NULL,
    "status" "FingerprintStatus" NOT NULL DEFAULT 'COLLECTION_FAILED',
    "failureReason" TEXT,
    "userId" TEXT,
    "preApplicationId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FingerprintEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_latestFingerprintHash_idx" ON "User"("latestFingerprintHash");

-- CreateIndex
CREATE INDEX "PreApplication_fingerprintHash_idx" ON "PreApplication"("fingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintProfile_fingerprintHash_key" ON "FingerprintProfile"("fingerprintHash");

-- CreateIndex
CREATE INDEX "FingerprintProfile_lastSeenAt_idx" ON "FingerprintProfile"("lastSeenAt");

-- CreateIndex
CREATE INDEX "FingerprintEvent_fingerprintId_createdAt_idx" ON "FingerprintEvent"("fingerprintId", "createdAt");

-- CreateIndex
CREATE INDEX "FingerprintEvent_fingerprintHash_createdAt_idx" ON "FingerprintEvent"("fingerprintHash", "createdAt");

-- CreateIndex
CREATE INDEX "FingerprintEvent_userId_createdAt_idx" ON "FingerprintEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FingerprintEvent_preApplicationId_createdAt_idx" ON "FingerprintEvent"("preApplicationId", "createdAt");

-- CreateIndex
CREATE INDEX "FingerprintEvent_eventType_createdAt_idx" ON "FingerprintEvent"("eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "FingerprintEvent"
ADD CONSTRAINT "FingerprintEvent_fingerprintId_fkey"
FOREIGN KEY ("fingerprintId") REFERENCES "FingerprintProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEvent"
ADD CONSTRAINT "FingerprintEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintEvent"
ADD CONSTRAINT "FingerprintEvent_preApplicationId_fkey"
FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
