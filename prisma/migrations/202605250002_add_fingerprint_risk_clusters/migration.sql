-- CreateTable
CREATE TABLE "FingerprintRiskCluster" (
    "id" TEXT NOT NULL,
    "anchorEventId" TEXT,
    "riskLevel" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "applicationCount" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "maxSimilarity" INTEGER,
    "evidenceFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "summary" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FingerprintRiskCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FingerprintRiskClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "similarityScore" INTEGER NOT NULL,
    "matchedKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "differentKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "strongKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FingerprintRiskClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FingerprintRiskCluster_riskLevel_lastSeenAt_idx"
ON "FingerprintRiskCluster"("riskLevel", "lastSeenAt");

-- CreateIndex
CREATE INDEX "FingerprintRiskCluster_lastSeenAt_idx"
ON "FingerprintRiskCluster"("lastSeenAt");

-- CreateIndex
CREATE INDEX "FingerprintRiskCluster_anchorEventId_idx"
ON "FingerprintRiskCluster"("anchorEventId");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintRiskClusterMember_eventId_key"
ON "FingerprintRiskClusterMember"("eventId");

-- CreateIndex
CREATE INDEX "FingerprintRiskClusterMember_clusterId_similarityScore_idx"
ON "FingerprintRiskClusterMember"("clusterId", "similarityScore");

-- CreateIndex
CREATE INDEX "FingerprintRiskClusterMember_eventId_idx"
ON "FingerprintRiskClusterMember"("eventId");

-- AddForeignKey
ALTER TABLE "FingerprintRiskCluster"
ADD CONSTRAINT "FingerprintRiskCluster_anchorEventId_fkey"
FOREIGN KEY ("anchorEventId") REFERENCES "FingerprintEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintRiskClusterMember"
ADD CONSTRAINT "FingerprintRiskClusterMember_clusterId_fkey"
FOREIGN KEY ("clusterId") REFERENCES "FingerprintRiskCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FingerprintRiskClusterMember"
ADD CONSTRAINT "FingerprintRiskClusterMember_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "FingerprintEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
