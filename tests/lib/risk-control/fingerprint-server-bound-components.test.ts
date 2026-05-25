import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(url: URL): string {
  return existsSync(url) ? readFileSync(url, "utf8") : ""
}

const schemaSource = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8")
const serverSource = readFileSync(
  new URL("../../../lib/fingerprint/server.ts", import.meta.url),
  "utf8",
)
const listRouteSource = readFileSync(
  new URL("../../../app/api/admin/risk-control/fingerprint-groups/route.ts", import.meta.url),
  "utf8",
)
const detailRouteSource = readFileSync(
  new URL(
    "../../../app/api/admin/risk-control/fingerprint-groups/[fingerprintHash]/route.ts",
    import.meta.url,
  ),
  "utf8",
)
const clusterListRouteSource = readIfExists(
  new URL("../../../app/api/admin/risk-control/fingerprint-clusters/route.ts", import.meta.url),
)
const clusterDetailRouteSource = readIfExists(
  new URL(
    "../../../app/api/admin/risk-control/fingerprint-clusters/[clusterId]/route.ts",
    import.meta.url,
  ),
)
const backfillScriptSource = readIfExists(
  new URL("../../../scripts/backfill-fingerprint-risk-clusters.ts", import.meta.url),
)
const riskCenterSource = readFileSync(
  new URL("../../../components/admin/risk-control-center.tsx", import.meta.url),
  "utf8",
)
const openApiSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const zhDictSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("schema stores full fingerprint components and similarity fields", () => {
  assert.match(schemaSource, /fingerprintBasis\s+Json\?/)
  assert.match(schemaSource, /componentKeys\s+String\[\]/)
  assert.match(schemaSource, /fingerprintComponents\s+Json\?/)
  assert.match(schemaSource, /fingerprintSummary\s+Json\?/)
  assert.match(schemaSource, /similarityScore\s+Int\?/)
  assert.match(schemaSource, /similaritySignals\s+Json\?/)
  assert.match(schemaSource, /@@index\(\[similarityScore, createdAt\]\)/)
})

test("schema stores full fingerprint risk clusters", () => {
  assert.match(schemaSource, /model FingerprintRiskCluster\s+\{/)
  assert.match(schemaSource, /model FingerprintRiskClusterMember\s+\{/)
  assert.match(schemaSource, /riskScore\s+Int/)
  assert.match(schemaSource, /evidenceFlags\s+String\[\]/)
  assert.match(schemaSource, /matchedKeys\s+String\[\]/)
  assert.match(schemaSource, /differentKeys\s+String\[\]/)
  assert.match(schemaSource, /strongKeys\s+String\[\]/)
  assert.match(schemaSource, /@@index\(\[riskLevel, lastSeenAt\]\)/)
})

test("server records component binding and similarity evidence", () => {
  assert.match(serverSource, /buildFingerprintBinding/)
  assert.match(serverSource, /selectBestFingerprintSimilarity/)
  assert.match(serverSource, /assignFingerprintRiskCluster/)
  assert.match(serverSource, /fingerprintComponents:/)
  assert.match(serverSource, /fingerprintSummary:/)
  assert.match(serverSource, /similarityScore:/)
  assert.match(serverSource, /similaritySignals:/)
})

test("fingerprint risk cluster backfill script replays historical events", () => {
  assert.match(backfillScriptSource, /backfillFingerprintRiskClusters/)
  assert.match(backfillScriptSource, /assignFingerprintRiskCluster/)
  assert.match(backfillScriptSource, /fingerprintEvent\.findMany/)
  assert.match(backfillScriptSource, /riskClusterMembers:\s*\{\s*none:/)
  assert.match(backfillScriptSource, /legacyWithoutComponents/)
})

test("admin routes return component summaries and similar events", () => {
  assert.match(listRouteSource, /maxSimilarityScore/)
  assert.match(listRouteSource, /fingerprintSummary/)
  assert.match(detailRouteSource, /fingerprintComponents/)
  assert.match(detailRouteSource, /similarEvents/)
  assert.match(detailRouteSource, /similaritySignals/)
})

test("admin routes expose full fingerprint risk clusters", () => {
  assert.match(clusterListRouteSource, /FingerprintRiskClusterListResponse/)
  assert.match(clusterListRouteSource, /riskScore/)
  assert.match(clusterListRouteSource, /clusterId/)
  assert.match(clusterDetailRouteSource, /FingerprintRiskClusterDetailResponse/)
  assert.match(clusterDetailRouteSource, /members/)
  assert.match(clusterDetailRouteSource, /componentEvidence/)
  assert.match(clusterDetailRouteSource, /ignoredImpact/)
})

test("risk control UI renders cluster details and full fingerprint evidence", () => {
  assert.match(riskCenterSource, /fingerprint-clusters/)
  assert.match(riskCenterSource, /selectedClusterId/)
  assert.doesNotMatch(riskCenterSource, /selectedHash/)
  assert.match(riskCenterSource, /riskScore/)
  assert.match(riskCenterSource, /fingerprintClusters/)
  assert.match(riskCenterSource, /clusterDetail/)
  assert.match(riskCenterSource, /memberEvents/)
  assert.match(riskCenterSource, /members/)
  assert.match(riskCenterSource, /componentEvidence/)
  assert.match(riskCenterSource, /compatibilityHash/)
})

test("openapi and dictionaries include server-bound fingerprint labels", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"similarityScore"\s*:/)
    assert.match(source, /"similarEvents"\s*:/)
    assert.match(source, /"componentDetails"\s*:/)
    assert.match(source, /"matchedComponents"\s*:/)
    assert.match(source, /"differentComponents"\s*:/)
    assert.match(source, /"fingerprintClusters"\s*:/)
    assert.match(source, /"clusterDetail"\s*:/)
    assert.match(source, /"riskScore"\s*:/)
    assert.match(source, /"keyEvidence"\s*:/)
    assert.match(source, /"memberEvents"\s*:/)
    assert.match(source, /"componentEvidence"\s*:/)
    assert.match(source, /"compatibilityHash"\s*:/)
  }

  assert.match(openApiSource, /fingerprintComponents/)
  assert.match(openApiSource, /similarityScore/)
  assert.match(openApiSource, /similarEvents/)
  assert.match(openApiSource, /\/admin\/risk-control\/fingerprint-clusters/)
  assert.match(openApiSource, /\/admin\/risk-control\/fingerprint-clusters\/\{clusterId\}/)
  assert.match(openApiSource, /clusterId/)
  assert.match(openApiSource, /riskScore/)
  assert.match(openApiSource, /componentEvidence/)
  assert.match(openApiSource, /members/)
})
