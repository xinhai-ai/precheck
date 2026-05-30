-- CreateEnum
CREATE TYPE "FingerprintLinkStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CLEARED', 'IGNORED');

-- AlterTable
ALTER TABLE "PreApplication" ADD COLUMN "fingerprintId" TEXT;

-- CreateTable
CREATE TABLE "DeviceFingerprint" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userAgent" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "device" TEXT,
    "language" TEXT,
    "languages" TEXT,
    "platform" TEXT,
    "screenResolution" TEXT,
    "timezone" TEXT,
    "timezoneOffset" INTEGER,
    "webglVendor" TEXT,
    "webglRenderer" TEXT,
    "canvasHash" TEXT,
    "audioHash" TEXT,
    "fonts" TEXT,
    "components" JSONB,
    "userId" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "confidence" DOUBLE PRECISION DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintLink" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userIds" TEXT[],
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "status" "FingerprintLinkStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceFingerprint_visitorId_idx" ON "DeviceFingerprint"("visitorId");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_userId_idx" ON "DeviceFingerprint"("userId");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_canvasHash_idx" ON "DeviceFingerprint"("canvasHash");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_ip_idx" ON "DeviceFingerprint"("ip");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_firstSeenAt_idx" ON "DeviceFingerprint"("firstSeenAt");

-- CreateIndex
CREATE INDEX "DeviceFingerprint_lastSeenAt_idx" ON "DeviceFingerprint"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintLink_visitorId_key" ON "FingerprintLink"("visitorId");

-- CreateIndex
CREATE INDEX "FingerprintLink_status_idx" ON "FingerprintLink"("status");

-- CreateIndex
CREATE INDEX "FingerprintLink_riskScore_idx" ON "FingerprintLink"("riskScore");

-- CreateIndex
CREATE INDEX "FingerprintLink_createdAt_idx" ON "FingerprintLink"("createdAt");

-- CreateIndex
CREATE INDEX "PreApplication_fingerprintId_idx" ON "PreApplication"("fingerprintId");

-- AddForeignKey
ALTER TABLE "PreApplication"
ADD CONSTRAINT "PreApplication_fingerprintId_fkey"
FOREIGN KEY ("fingerprintId") REFERENCES "DeviceFingerprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFingerprint"
ADD CONSTRAINT "DeviceFingerprint_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintLink"
ADD CONSTRAINT "FingerprintLink_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
