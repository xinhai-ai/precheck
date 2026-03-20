import test from "node:test"
import assert from "node:assert/strict"

async function loadFingerprintRiskModule() {
  return import(new URL("../../../lib/risk-control/fingerprint-risk.ts", import.meta.url).href)
}

test("computeRiskLevel returns HIGH for 3 users", async () => {
  const { computeRiskLevel } = await loadFingerprintRiskModule()
  assert.equal(computeRiskLevel(3, 1), "HIGH")
})

test("computeRiskLevel returns MEDIUM for 2 applications", async () => {
  const { computeRiskLevel } = await loadFingerprintRiskModule()
  assert.equal(computeRiskLevel(1, 2), "MEDIUM")
})

test("computeRiskLevel returns LOW below thresholds", async () => {
  const { computeRiskLevel } = await loadFingerprintRiskModule()
  assert.equal(computeRiskLevel(1, 1), "LOW")
})

test("sanitizeRiskSort falls back to lastSeenAt desc", async () => {
  const { sanitizeRiskSort } = await loadFingerprintRiskModule()
  assert.deepEqual(sanitizeRiskSort("bad", "bad"), { sortBy: "lastSeenAt", sortOrder: "desc" })
})

test("sanitizeRiskSort allows userCount asc", async () => {
  const { sanitizeRiskSort } = await loadFingerprintRiskModule()
  assert.deepEqual(sanitizeRiskSort("userCount", "asc"), { sortBy: "userCount", sortOrder: "asc" })
})

test("Safari hash without extra evidence stays low confidence and low risk", async () => {
  const { computeFingerprintRiskAssessment } = await loadFingerprintRiskModule()
  assert.deepEqual(
    computeFingerprintRiskAssessment({
      primaryBrowserFamily: "SAFARI",
      userCount: 4,
      applicationCount: 4,
      recentDistinctUsers: 1,
      recentDistinctApplications: 1,
      overlappingNetworkCount: 0,
      crossEventUserCount: 0,
    }),
    {
      browserConfidence: "LOW_CONFIDENCE",
      evidenceFlags: [],
      riskLevel: "LOW",
      riskExplanation: "Safari fingerprint downgraded until extra evidence is present.",
    },
  )
})

test("Safari hash with one strong signal becomes medium risk", async () => {
  const { computeFingerprintRiskAssessment } = await loadFingerprintRiskModule()
  assert.equal(
    computeFingerprintRiskAssessment({
      primaryBrowserFamily: "SAFARI",
      userCount: 2,
      applicationCount: 2,
      recentDistinctUsers: 2,
      recentDistinctApplications: 1,
      overlappingNetworkCount: 0,
      crossEventUserCount: 0,
    }).riskLevel,
    "MEDIUM",
  )
})

test("Safari hash with two strong signals becomes high risk", async () => {
  const { computeFingerprintRiskAssessment } = await loadFingerprintRiskModule()
  assert.equal(
    computeFingerprintRiskAssessment({
      primaryBrowserFamily: "SAFARI",
      userCount: 2,
      applicationCount: 2,
      recentDistinctUsers: 2,
      recentDistinctApplications: 2,
      overlappingNetworkCount: 2,
      crossEventUserCount: 0,
    }).riskLevel,
    "HIGH",
  )
})
