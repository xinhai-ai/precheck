CREATE TABLE "PasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialID" TEXT NOT NULL,
  "publicKey" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deviceType" TEXT NOT NULL,
  "backedUp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),

  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasskeyCredential_credentialID_key" ON "PasskeyCredential"("credentialID");
CREATE INDEX "PasskeyCredential_userId_createdAt_idx" ON "PasskeyCredential"("userId", "createdAt");

ALTER TABLE "PasskeyCredential"
  ADD CONSTRAINT "PasskeyCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
