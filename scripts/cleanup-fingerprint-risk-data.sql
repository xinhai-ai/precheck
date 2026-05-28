-- Fingerprint and risk-control data cleanup helper.
-- Intended for environments where the application code has already been deployed without fingerprint/risk-control references.
-- Safe to run more than once on PostgreSQL.

BEGIN;

DROP TABLE IF EXISTS "FingerprintRiskClusterMember";
DROP TABLE IF EXISTS "FingerprintRiskCluster";
DROP TABLE IF EXISTS "RiskIgnoredUser";
DROP TABLE IF EXISTS "FingerprintEvent";
DROP TABLE IF EXISTS "FingerprintProfile";

DROP INDEX IF EXISTS "User_latestFingerprintHash_idx";
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "latestFingerprintHash",
  DROP COLUMN IF EXISTS "latestFingerprintAt";

DROP INDEX IF EXISTS "PreApplication_fingerprintHash_idx";
ALTER TABLE "PreApplication"
  DROP COLUMN IF EXISTS "fingerprintHash",
  DROP COLUMN IF EXISTS "fingerprintCollectedAt",
  DROP COLUMN IF EXISTS "fingerprintStatus";

DROP TYPE IF EXISTS "FingerprintStatus";

COMMIT;
