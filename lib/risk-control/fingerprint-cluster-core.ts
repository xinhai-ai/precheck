import type { FingerprintSimilaritySignals } from "@/lib/fingerprint/types"
import type { BrowserConfidence, RiskLevel } from "@/lib/risk-control/fingerprint-risk"

export type FingerprintClusterEvidence =
  | "recentConcentration"
  | "networkOverlap"
  | "crossEventContinuity"
  | "componentSimilarity"
  | "strongComponentMatch"
  | "hashExactMatch"
  | "safariLowConfidence"

export type FingerprintClusterAssessmentInput = {
  primaryBrowserFamily: string | null
  userCount: number
  applicationCount: number
  eventCount: number
  maxSimilarityScore: number | null
  strongMatchCount: number
  recentDistinctUsers: number
  recentDistinctApplications: number
  overlappingNetworkCount: number
  crossEventUserCount: number
  exactHashMatch: boolean
}

export type FingerprintClusterAssessment = {
  browserConfidence: BrowserConfidence
  evidenceFlags: FingerprintClusterEvidence[]
  riskLevel: RiskLevel
  riskScore: number
  riskExplanation: string
}

export type FingerprintClusterJoinInput = {
  similarityScore: number
  strongKeyCount: number
  hasNetworkOverlap: boolean
  hasRecentConcentration: boolean
  exactHashMatch: boolean
}

export type FingerprintClusterMemberInput = {
  eventId: string
  similarityScore: number
  signals: FingerprintSimilaritySignals
}

export type FingerprintClusterMemberDraft = {
  eventId: string
  similarityScore: number
  matchedKeys: string[]
  differentKeys: string[]
  strongKeys: string[]
}

function clampRiskScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function computeRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return "HIGH"
  if (score >= 40) return "MEDIUM"
  return "LOW"
}

export function computeFingerprintClusterAssessment(
  input: FingerprintClusterAssessmentInput,
): FingerprintClusterAssessment {
  const evidenceFlags: FingerprintClusterEvidence[] = []
  const maxSimilarityScore = input.maxSimilarityScore || 0
  const isSafari = input.primaryBrowserFamily === "SAFARI"
  const browserConfidence: BrowserConfidence = isSafari ? "LOW_CONFIDENCE" : "HIGH_CONFIDENCE"

  let riskScore = 0

  if (maxSimilarityScore >= 85) {
    riskScore += 35
    evidenceFlags.push("componentSimilarity")
  }

  if (input.strongMatchCount >= 2) {
    riskScore += 25
    evidenceFlags.push("strongComponentMatch")
  }

  if (input.userCount >= 2) {
    riskScore += 20
  }

  if (input.applicationCount >= 2) {
    riskScore += 15
  }

  if (input.recentDistinctUsers >= 2 || input.recentDistinctApplications >= 2) {
    riskScore += 15
    evidenceFlags.push("recentConcentration")
  }

  if (input.overlappingNetworkCount >= 2) {
    riskScore += 10
    evidenceFlags.push("networkOverlap")
  }

  if (input.crossEventUserCount >= 1) {
    riskScore += 10
    evidenceFlags.push("crossEventContinuity")
  }

  if (input.exactHashMatch) {
    riskScore += 10
    evidenceFlags.push("hashExactMatch")
  }

  if (isSafari && evidenceFlags.length <= 1) {
    riskScore -= 20
    evidenceFlags.push("safariLowConfidence")
  }

  const finalRiskScore = clampRiskScore(riskScore)
  const riskLevel = computeRiskLevelFromScore(finalRiskScore)

  const riskExplanation =
    maxSimilarityScore >= 85 || input.strongMatchCount >= 2
      ? "Full fingerprint similarity promoted by component evidence."
      : isSafari
        ? "Safari fingerprint cluster stays low until extra evidence is present."
        : input.exactHashMatch
          ? "Legacy hash match is retained as supporting evidence."
          : "No full fingerprint evidence matched."

  return {
    browserConfidence,
    evidenceFlags,
    riskLevel,
    riskScore: finalRiskScore,
    riskExplanation,
  }
}

export function shouldJoinFingerprintCluster(input: FingerprintClusterJoinInput): boolean {
  if (input.similarityScore >= 85) return true
  if (input.similarityScore >= 75 && input.strongKeyCount >= 2) return true
  if (input.similarityScore >= 65 && input.hasNetworkOverlap && input.hasRecentConcentration) {
    return true
  }

  return false
}

export function buildFingerprintClusterMember(
  input: FingerprintClusterMemberInput,
): FingerprintClusterMemberDraft {
  return {
    eventId: input.eventId,
    similarityScore: input.similarityScore,
    matchedKeys: input.signals.matched || [],
    differentKeys: input.signals.different || [],
    strongKeys: input.signals.strong || [],
  }
}
