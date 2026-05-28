-- Drop fingerprint risk-control cluster tables first because they depend on fingerprint events.
DROP TABLE IF EXISTS "FingerprintRiskClusterMember";
DROP TABLE IF EXISTS "FingerprintRiskCluster";

-- Drop legacy risk-control ignore table.
DROP TABLE IF EXISTS "RiskIgnoredUser";

-- Drop fingerprint event/profile tables.
DROP TABLE IF EXISTS "FingerprintEvent";
DROP TABLE IF EXISTS "FingerprintProfile";

-- Drop fingerprint columns from first-party entities.
DROP INDEX IF EXISTS "User_latestFingerprintHash_idx";
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "latestFingerprintHash",
  DROP COLUMN IF EXISTS "latestFingerprintAt";

DROP INDEX IF EXISTS "PreApplication_fingerprintHash_idx";
ALTER TABLE "PreApplication"
  DROP COLUMN IF EXISTS "fingerprintHash",
  DROP COLUMN IF EXISTS "fingerprintCollectedAt",
  DROP COLUMN IF EXISTS "fingerprintStatus";

-- Drop enum after dependent columns and tables are gone.
DROP TYPE IF EXISTS "FingerprintStatus";
