import { Prisma, type PrismaClient } from "@prisma/client"
import { flattenFingerprintComponents } from "@/lib/fingerprint/components"
import { compareFingerprintComponents } from "@/lib/fingerprint/similarity"
import type {
  FingerprintComponents,
  FingerprintSimilaritySignals,
  FingerprintSummary,
} from "@/lib/fingerprint/types"
import {
  buildFingerprintClusterMember,
  computeFingerprintClusterAssessment,
  shouldJoinFingerprintCluster,
} from "@/lib/risk-control/fingerprint-cluster-core"
export type {
  FingerprintClusterAssessment,
  FingerprintClusterAssessmentInput,
  FingerprintClusterEvidence,
  FingerprintClusterJoinInput,
  FingerprintClusterMemberDraft,
  FingerprintClusterMemberInput,
} from "@/lib/risk-control/fingerprint-cluster-core"

export type AssignFingerprintRiskClusterInput = {
  db: PrismaClient
  eventId: string
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function toFingerprintComponents(value: unknown): FingerprintComponents | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as FingerprintComponents
}

function toFingerprintSummary(value: unknown): FingerprintSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as FingerprintSummary
}

function getPrimaryBrowserFamily(events: Array<{ browserFamily: string | null }>): string | null {
  const counts = new Map<string, number>()

  for (const event of events) {
    const browserFamily = event.browserFamily?.trim()
    if (!browserFamily) continue
    counts.set(browserFamily, (counts.get(browserFamily) || 0) + 1)
  }

  let primary: string | null = null
  let topCount = 0

  for (const [browserFamily, count] of counts.entries()) {
    if (count > topCount) {
      primary = browserFamily
      topCount = count
    }
  }

  return primary
}

function getRecentDistinctCount<T>(
  events: Array<{ createdAt: Date } & T>,
  getter: (event: T) => string | null,
): number {
  const cutoff = Date.now() - ONE_DAY_MS
  return new Set(
    events
      .filter((event) => event.createdAt.getTime() >= cutoff)
      .map((event) => getter(event))
      .filter((value): value is string => Boolean(value)),
  ).size
}

function getOverlappingNetworkCount(events: Array<{ createdAt: Date; networkKey: string | null }>) {
  const cutoff = Date.now() - ONE_DAY_MS
  const counts = new Map<string, number>()

  for (const event of events) {
    if (event.createdAt.getTime() < cutoff) continue
    const networkKey = event.networkKey?.trim()
    if (!networkKey) continue
    counts.set(networkKey, (counts.get(networkKey) || 0) + 1)
  }

  return Math.max(0, ...Array.from(counts.values()))
}

function getCrossEventUserCount(events: Array<{ userId: string | null; eventType: string }>) {
  const eventTypesByUser = new Map<string, Set<string>>()

  for (const event of events) {
    if (!event.userId) continue
    const existing = eventTypesByUser.get(event.userId) || new Set<string>()
    existing.add(event.eventType)
    eventTypesByUser.set(event.userId, existing)
  }

  return Array.from(eventTypesByUser.values()).filter((types) => types.size >= 2).length
}

function hasExactHashMatch(events: Array<{ fingerprintHash: string | null }>) {
  const counts = new Map<string, number>()

  for (const event of events) {
    const fingerprintHash = event.fingerprintHash?.trim()
    if (!fingerprintHash) continue
    counts.set(fingerprintHash, (counts.get(fingerprintHash) || 0) + 1)
  }

  return Array.from(counts.values()).some((count) => count >= 2)
}

function buildAnchorMember(eventId: string, components: FingerprintComponents) {
  const keys = Array.from(flattenFingerprintComponents(components).keys())
  const strongKeys = keys.filter((key) =>
    ["graphics.webglRenderer", "graphics.canvas", "graphics.webglVendor"].includes(key),
  )

  return {
    eventId,
    similarityScore: 100,
    matchedKeys: keys,
    differentKeys: [],
    strongKeys,
  }
}

async function refreshFingerprintRiskCluster(input: {
  prisma: any
  clusterId: string
  fallbackSummary: FingerprintSummary | null
}) {
  const memberRows = await input.prisma.fingerprintRiskClusterMember.findMany({
    where: { clusterId: input.clusterId },
    select: {
      similarityScore: true,
      strongKeys: true,
      event: {
        select: {
          fingerprintHash: true,
          fingerprintSummary: true,
          browserFamily: true,
          networkKey: true,
          createdAt: true,
          userId: true,
          preApplicationId: true,
          eventType: true,
        },
      },
    },
  })

  const events = memberRows.map((row: any) => row.event).filter(Boolean)
  const userCount = new Set(
    events
      .map((event: any) => event.userId)
      .filter((value: unknown): value is string => Boolean(value)),
  ).size
  const applicationCount = new Set(
    events
      .map((event: any) => event.preApplicationId)
      .filter((value: unknown): value is string => Boolean(value)),
  ).size
  const maxSimilarityScore = Math.max(
    0,
    ...memberRows
      .map((row: any) => Number(row.similarityScore || 0))
      .filter((score: number) => score < 100),
  )
  const strongMatchCount = Math.max(
    0,
    ...memberRows.map((row: any) => (Array.isArray(row.strongKeys) ? row.strongKeys.length : 0)),
  )
  const assessment = computeFingerprintClusterAssessment({
    primaryBrowserFamily: getPrimaryBrowserFamily(events),
    userCount,
    applicationCount,
    eventCount: events.length,
    maxSimilarityScore,
    strongMatchCount,
    recentDistinctUsers: getRecentDistinctCount(events, (event: any) => event.userId),
    recentDistinctApplications: getRecentDistinctCount(
      events,
      (event: any) => event.preApplicationId,
    ),
    overlappingNetworkCount: getOverlappingNetworkCount(events),
    crossEventUserCount: getCrossEventUserCount(events),
    exactHashMatch: hasExactHashMatch(events),
  })
  const firstSeenAt = events.reduce(
    (earliest: Date | null, event: any) =>
      !earliest || event.createdAt < earliest ? event.createdAt : earliest,
    null,
  )
  const lastSeenAt = events.reduce(
    (latest: Date | null, event: any) =>
      !latest || event.createdAt > latest ? event.createdAt : latest,
    null,
  )
  const summary =
    events.map((event: any) => toFingerprintSummary(event.fingerprintSummary)).find(Boolean) ||
    input.fallbackSummary

  await input.prisma.fingerprintRiskCluster.update({
    where: { id: input.clusterId },
    data: {
      riskLevel: assessment.riskLevel,
      riskScore: assessment.riskScore,
      userCount,
      applicationCount,
      eventCount: events.length,
      maxSimilarity: maxSimilarityScore > 0 ? maxSimilarityScore : null,
      evidenceFlags: assessment.evidenceFlags,
      summary: summary ? (summary as Prisma.InputJsonValue) : undefined,
      firstSeenAt: firstSeenAt || new Date(),
      lastSeenAt: lastSeenAt || new Date(),
    },
  })
}

export async function assignFingerprintRiskCluster(input: AssignFingerprintRiskClusterInput) {
  const prisma = input.db as any
  const existing = await prisma.fingerprintRiskClusterMember.findUnique({
    where: { eventId: input.eventId },
    select: { clusterId: true },
  })

  if (existing) {
    return existing.clusterId
  }

  const event = await prisma.fingerprintEvent.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      fingerprintHash: true,
      fingerprintComponents: true,
      fingerprintSummary: true,
      browserFamily: true,
      networkKey: true,
      createdAt: true,
      userId: true,
      preApplicationId: true,
      eventType: true,
    },
  })

  if (!event) return null

  const components = toFingerprintComponents(event.fingerprintComponents)
  const summary = toFingerprintSummary(event.fingerprintSummary)

  if (!components) {
    const assessment = computeFingerprintClusterAssessment({
      primaryBrowserFamily: event.browserFamily,
      userCount: event.userId ? 1 : 0,
      applicationCount: event.preApplicationId ? 1 : 0,
      eventCount: 1,
      maxSimilarityScore: null,
      strongMatchCount: 0,
      recentDistinctUsers: event.userId ? 1 : 0,
      recentDistinctApplications: event.preApplicationId ? 1 : 0,
      overlappingNetworkCount: 0,
      crossEventUserCount: 0,
      exactHashMatch: Boolean(event.fingerprintHash),
    })
    const cluster = await prisma.fingerprintRiskCluster.create({
      data: {
        anchorEventId: event.id,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        userCount: event.userId ? 1 : 0,
        applicationCount: event.preApplicationId ? 1 : 0,
        eventCount: 1,
        evidenceFlags: assessment.evidenceFlags,
        summary: summary ? (summary as Prisma.InputJsonValue) : undefined,
        firstSeenAt: event.createdAt,
        lastSeenAt: event.createdAt,
        members: {
          create: {
            eventId: event.id,
            similarityScore: 0,
            matchedKeys: [],
            differentKeys: [],
            strongKeys: [],
          },
        },
      },
      select: { id: true },
    })
    return cluster.id
  }

  const candidates = await prisma.fingerprintEvent.findMany({
    where: {
      id: { not: event.id },
      fingerprintComponents: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      fingerprintHash: true,
      fingerprintComponents: true,
      networkKey: true,
      createdAt: true,
      riskClusterMembers: {
        select: { clusterId: true },
        take: 1,
      },
    },
  })

  let best: {
    clusterId: string
    score: number
    signals: FingerprintSimilaritySignals
    exactHashMatch: boolean
    hasNetworkOverlap: boolean
    hasRecentConcentration: boolean
  } | null = null

  for (const candidate of candidates) {
    const candidateComponents = toFingerprintComponents(candidate.fingerprintComponents)
    const clusterId = candidate.riskClusterMembers?.[0]?.clusterId
    if (!candidateComponents || !clusterId) continue

    const result = compareFingerprintComponents(components, candidateComponents)
    const hasNetworkOverlap = Boolean(event.networkKey && event.networkKey === candidate.networkKey)
    const hasRecentConcentration =
      Math.abs(event.createdAt.getTime() - candidate.createdAt.getTime()) <= ONE_DAY_MS
    const exactHashMatch = Boolean(
      event.fingerprintHash && event.fingerprintHash === candidate.fingerprintHash,
    )

    if (
      shouldJoinFingerprintCluster({
        similarityScore: result.score,
        strongKeyCount: result.signals.strong.length,
        hasNetworkOverlap,
        hasRecentConcentration,
        exactHashMatch,
      }) &&
      (!best || result.score > best.score)
    ) {
      best = {
        clusterId,
        score: result.score,
        signals: result.signals,
        exactHashMatch,
        hasNetworkOverlap,
        hasRecentConcentration,
      }
    }
  }

  if (!best) {
    const assessment = computeFingerprintClusterAssessment({
      primaryBrowserFamily: event.browserFamily,
      userCount: event.userId ? 1 : 0,
      applicationCount: event.preApplicationId ? 1 : 0,
      eventCount: 1,
      maxSimilarityScore: null,
      strongMatchCount: 0,
      recentDistinctUsers: event.userId ? 1 : 0,
      recentDistinctApplications: event.preApplicationId ? 1 : 0,
      overlappingNetworkCount: event.networkKey ? 1 : 0,
      crossEventUserCount: 0,
      exactHashMatch: false,
    })
    const cluster = await prisma.fingerprintRiskCluster.create({
      data: {
        anchorEventId: event.id,
        riskLevel: assessment.riskLevel,
        riskScore: assessment.riskScore,
        userCount: event.userId ? 1 : 0,
        applicationCount: event.preApplicationId ? 1 : 0,
        eventCount: 1,
        evidenceFlags: assessment.evidenceFlags,
        summary: summary ? (summary as Prisma.InputJsonValue) : undefined,
        firstSeenAt: event.createdAt,
        lastSeenAt: event.createdAt,
        members: { create: buildAnchorMember(event.id, components) },
      },
      select: { id: true },
    })
    return cluster.id
  }

  await prisma.fingerprintRiskClusterMember.create({
    data: {
      clusterId: best.clusterId,
      ...buildFingerprintClusterMember({
        eventId: event.id,
        similarityScore: best.score,
        signals: best.signals,
      }),
    },
  })
  await refreshFingerprintRiskCluster({
    prisma,
    clusterId: best.clusterId,
    fallbackSummary: summary,
  })

  return best.clusterId
}
