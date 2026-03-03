-- CreateTable
CREATE TABLE "RiskIgnoredUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskIgnoredUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskIgnoredUser_userId_key" ON "RiskIgnoredUser"("userId");

-- CreateIndex
CREATE INDEX "RiskIgnoredUser_createdById_idx" ON "RiskIgnoredUser"("createdById");

-- CreateIndex
CREATE INDEX "RiskIgnoredUser_createdAt_idx" ON "RiskIgnoredUser"("createdAt");

-- AddForeignKey
ALTER TABLE "RiskIgnoredUser" ADD CONSTRAINT "RiskIgnoredUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskIgnoredUser" ADD CONSTRAINT "RiskIgnoredUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
