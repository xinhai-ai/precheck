import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const fingerprintRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/[id]/fingerprint/route.ts", import.meta.url),
  "utf8",
)
const preApplicationsTableSource = readFileSync(
  new URL("../../../components/admin/pre-applications-table.tsx", import.meta.url),
  "utf8",
)

test("pre-application fingerprint detail reads related data from risk cluster members", () => {
  assert.match(fingerprintRouteSource, /fingerprintEvent\.findFirst/)
  assert.match(fingerprintRouteSource, /fingerprintRiskClusterMember/)
  assert.match(fingerprintRouteSource, /clusterId/)
  assert.match(fingerprintRouteSource, /riskCluster/)
  assert.match(fingerprintRouteSource, /siblingEvents/)
  assert.match(fingerprintRouteSource, /ARCHIVED_PRE_APPLICATION_STATUS/)
  assert.match(fingerprintRouteSource, /canViewArchivedPreApplications/)
})

test("pre-application detail renders fingerprint risk cluster summary", () => {
  assert.match(preApplicationsTableSource, /type FingerprintRiskClusterSummary/)
  assert.match(
    preApplicationsTableSource,
    /riskCluster:\s*FingerprintRiskClusterSummary\s*\|\s*null/,
  )
  assert.match(preApplicationsTableSource, /fingerprintDetail\?\.riskCluster/)
  assert.match(preApplicationsTableSource, /formatEvidenceFlag/)
  assert.match(preApplicationsTableSource, /compatibilityHash/)
  assert.match(preApplicationsTableSource, /maxSimilarity/)
  assert.match(preApplicationsTableSource, /eventCount/)
})

test("pre-application fingerprint panel defaults collapsed when no risk is present", () => {
  assert.match(preApplicationsTableSource, /function hasFingerprintRisk/)
  assert.match(preApplicationsTableSource, /fingerprintSectionValue/)
  assert.match(
    preApplicationsTableSource,
    /setFingerprintSectionValue\(hasFingerprintRisk\(fingerprintDetail\) \? \["fingerprint"\] : \[\]\)/,
  )
  assert.match(
    preApplicationsTableSource,
    /<Accordion\s+type="multiple"\s+value=\{fingerprintSectionValue\}/,
  )
  assert.match(preApplicationsTableSource, /<AccordionItem\s+value="fingerprint"/)
})
