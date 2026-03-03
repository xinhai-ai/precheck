-- AlterEnum
ALTER TYPE "PreApplicationStatus" ADD VALUE IF NOT EXISTS 'SHADOW_HIDDEN';

-- CreateTable
CREATE TABLE "ShadowBannedUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowBannedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShadowBannedUser_userId_key" ON "ShadowBannedUser"("userId");

-- CreateIndex
CREATE INDEX "ShadowBannedUser_createdById_idx" ON "ShadowBannedUser"("createdById");

-- CreateIndex
CREATE INDEX "ShadowBannedUser_createdAt_idx" ON "ShadowBannedUser"("createdAt");

-- AddForeignKey
ALTER TABLE "ShadowBannedUser" ADD CONSTRAINT "ShadowBannedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowBannedUser" ADD CONSTRAINT "ShadowBannedUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
