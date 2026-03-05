CREATE TABLE "PreApplicationDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "essay" TEXT NOT NULL DEFAULT '',
  "source" "PreApplicationSource",
  "sourceDetail" TEXT,
  "registerEmail" TEXT NOT NULL DEFAULT '',
  "group" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreApplicationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreApplicationDraft_userId_key" ON "PreApplicationDraft"("userId");

CREATE INDEX "PreApplicationDraft_updatedAt_idx" ON "PreApplicationDraft"("updatedAt");

ALTER TABLE "PreApplicationDraft"
  ADD CONSTRAINT "PreApplicationDraft_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
