import test from "node:test"
import assert from "node:assert/strict"

async function loadFingerprintClusterModule() {
  return import(
    new URL("../../../lib/risk-control/fingerprint-cluster-core.ts", import.meta.url).href
  )
}

test("computeFingerprintClusterAssessment promotes full component similarity with strong evidence", async () => {
  const { computeFingerprintClusterAssessment } = await loadFingerprintClusterModule()

  assert.deepEqual(
    computeFingerprintClusterAssessment({
      primaryBrowserFamily: "CHROME",
      userCount: 2,
      applicationCount: 2,
      eventCount: 3,
      maxSimilarityScore: 88,
      strongMatchCount: 2,
      recentDistinctUsers: 2,
      recentDistinctApplications: 1,
      overlappingNetworkCount: 0,
      crossEventUserCount: 0,
      exactHashMatch: false,
    }),
    {
      browserConfidence: "HIGH_CONFIDENCE",
      evidenceFlags: ["componentSimilarity", "strongComponentMatch", "recentConcentration"],
      riskLevel: "HIGH",
      riskScore: 100,
      riskExplanation: "Full fingerprint similarity promoted by component evidence.",
    },
  )
})

test("computeFingerprintClusterAssessment downgrades Safari without extra evidence", async () => {
  const { computeFingerprintClusterAssessment } = await loadFingerprintClusterModule()

  assert.deepEqual(
    computeFingerprintClusterAssessment({
      primaryBrowserFamily: "SAFARI",
      userCount: 1,
      applicationCount: 1,
      eventCount: 1,
      maxSimilarityScore: 0,
      strongMatchCount: 0,
      recentDistinctUsers: 1,
      recentDistinctApplications: 1,
      overlappingNetworkCount: 0,
      crossEventUserCount: 0,
      exactHashMatch: false,
    }),
    {
      browserConfidence: "LOW_CONFIDENCE",
      evidenceFlags: ["safariLowConfidence"],
      riskLevel: "LOW",
      riskScore: 0,
      riskExplanation: "Safari fingerprint cluster stays low until extra evidence is present.",
    },
  )
})

test("computeFingerprintClusterAssessment treats legacy exact hash as supporting evidence only", async () => {
  const { computeFingerprintClusterAssessment } = await loadFingerprintClusterModule()

  const assessment = computeFingerprintClusterAssessment({
    primaryBrowserFamily: "FIREFOX",
    userCount: 1,
    applicationCount: 1,
    eventCount: 2,
    maxSimilarityScore: 50,
    strongMatchCount: 0,
    recentDistinctUsers: 1,
    recentDistinctApplications: 1,
    overlappingNetworkCount: 0,
    crossEventUserCount: 0,
    exactHashMatch: true,
  })

  assert.equal(assessment.riskLevel, "LOW")
  assert.equal(assessment.riskScore, 10)
  assert.deepEqual(assessment.evidenceFlags, ["hashExactMatch"])
})

test("shouldJoinFingerprintCluster requires high similarity or extra evidence", async () => {
  const { shouldJoinFingerprintCluster } = await loadFingerprintClusterModule()

  assert.equal(
    shouldJoinFingerprintCluster({
      similarityScore: 86,
      strongKeyCount: 0,
      hasNetworkOverlap: false,
      hasRecentConcentration: false,
      exactHashMatch: false,
    }),
    true,
  )

  assert.equal(
    shouldJoinFingerprintCluster({
      similarityScore: 76,
      strongKeyCount: 2,
      hasNetworkOverlap: false,
      hasRecentConcentration: false,
      exactHashMatch: false,
    }),
    true,
  )

  assert.equal(
    shouldJoinFingerprintCluster({
      similarityScore: 66,
      strongKeyCount: 0,
      hasNetworkOverlap: true,
      hasRecentConcentration: true,
      exactHashMatch: false,
    }),
    true,
  )

  assert.equal(
    shouldJoinFingerprintCluster({
      similarityScore: 50,
      strongKeyCount: 0,
      hasNetworkOverlap: false,
      hasRecentConcentration: false,
      exactHashMatch: true,
    }),
    false,
  )
})

test("buildFingerprintClusterMember maps similarity signals into persisted member fields", async () => {
  const { buildFingerprintClusterMember } = await loadFingerprintClusterModule()

  assert.deepEqual(
    buildFingerprintClusterMember({
      eventId: "evt_1",
      similarityScore: 91,
      signals: {
        matched: ["graphics.canvas", "graphics.webglRenderer"],
        different: ["screen.width"],
        strong: ["graphics.canvas", "graphics.webglRenderer"],
        comparedEventId: "evt_anchor",
        comparedFingerprintHash: "legacy_hash",
      },
    }),
    {
      eventId: "evt_1",
      similarityScore: 91,
      matchedKeys: ["graphics.canvas", "graphics.webglRenderer"],
      differentKeys: ["screen.width"],
      strongKeys: ["graphics.canvas", "graphics.webglRenderer"],
    },
  )
})
