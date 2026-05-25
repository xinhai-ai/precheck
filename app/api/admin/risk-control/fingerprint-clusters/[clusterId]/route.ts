import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import type { RiskLevel } from "@/lib/risk-control/fingerprint-risk"

type FingerprintRiskClusterMemberDetail = {
  id: string
  eventId: string
  similarityScore: number
  matchedKeys: string[]
  differentKeys: string[]
  strongKeys: string[]
  eventType: string
  createdAt: string
  ip: string | null
  browserFamily: string | null
  networkKey: string | null
  fingerprintHash: string | null
  fingerprintSummary: unknown
}

type FingerprintRiskClusterDetailResponse = {
  summary: {
    id: string
    clusterId: string
    riskLevel: RiskLevel
    riskScore: number
    userCount: number
    applicationCount: number
    eventCount: number
    maxSimilarity: number | null
    evidenceFlags: string[]
    summary: unknown
    firstSeenAt: string
    lastSeenAt: string
  }
  relatedUsers: unknown[]
  relatedApplications: unknown[]
  members: FingerprintRiskClusterMemberDetail[]
  componentEvidence: {
    anchor: unknown
    samples: unknown[]
  }
  ignoredImpact: number
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const output: T[] = []

  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    output.push(item)
  }

  return output
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clusterId: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { clusterId: rawClusterId } = await context.params
    const clusterId = decodeURIComponent(rawClusterId || "").trim()
    if (!clusterId) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, { status: 400 })
    }

    const prisma = db as any
    const ignoredRows = await prisma.riskIgnoredUser.findMany({
      select: { userId: true },
    })
    const ignoredUserIds = new Set(ignoredRows.map((row: any) => row.userId))
    const cluster = await prisma.fingerprintRiskCluster.findUnique({
      where: { id: clusterId },
      select: {
        id: true,
        riskLevel: true,
        riskScore: true,
        userCount: true,
        applicationCount: true,
        eventCount: true,
        maxSimilarity: true,
        evidenceFlags: true,
        summary: true,
        firstSeenAt: true,
        lastSeenAt: true,
        anchorEvent: {
          select: {
            fingerprintComponents: true,
          },
        },
        members: {
          orderBy: { similarityScore: "desc" },
          take: 100,
          select: {
            id: true,
            eventId: true,
            similarityScore: true,
            matchedKeys: true,
            differentKeys: true,
            strongKeys: true,
            event: {
              select: {
                fingerprintHash: true,
                eventType: true,
                status: true,
                failureReason: true,
                ip: true,
                browserFamily: true,
                networkKey: true,
                fingerprintSummary: true,
                fingerprintComponents: true,
                createdAt: true,
                userId: true,
                preApplicationId: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                  },
                },
                preApplication: {
                  select: {
                    id: true,
                    status: true,
                    registerEmail: true,
                    essay: true,
                    createdAt: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!cluster) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    const events = cluster.members.map((member: any) => member.event).filter(Boolean)
    const relatedUsers = uniqueById(
      events
        .map((event: any) => event.user)
        .filter((item: unknown): item is { id: string } => Boolean(item && (item as any).id)),
    )
    const relatedApplications = uniqueById(
      events
        .map((event: any) => event.preApplication)
        .filter((item: unknown): item is { id: string } => Boolean(item && (item as any).id)),
    )
    const ignoredImpact = relatedUsers.filter((item) => ignoredUserIds.has(item.id)).length
    const samples = events
      .map((event: any) => event.fingerprintComponents)
      .filter(Boolean)
      .slice(0, 5)

    const response: FingerprintRiskClusterDetailResponse = {
      summary: {
        id: cluster.id,
        clusterId: cluster.id,
        riskLevel: cluster.riskLevel,
        riskScore: cluster.riskScore,
        userCount: cluster.userCount,
        applicationCount: cluster.applicationCount,
        eventCount: cluster.eventCount,
        maxSimilarity: cluster.maxSimilarity,
        evidenceFlags: cluster.evidenceFlags || [],
        summary: cluster.summary || null,
        firstSeenAt: cluster.firstSeenAt.toISOString(),
        lastSeenAt: cluster.lastSeenAt.toISOString(),
      },
      relatedUsers,
      relatedApplications: relatedApplications.map((item: any) => ({
        ...item,
        createdAt: item.createdAt?.toISOString?.() || item.createdAt,
      })),
      members: cluster.members.map((member: any) => ({
        id: member.id,
        eventId: member.eventId,
        similarityScore: member.similarityScore,
        matchedKeys: member.matchedKeys || [],
        differentKeys: member.differentKeys || [],
        strongKeys: member.strongKeys || [],
        eventType: member.event?.eventType || "-",
        createdAt: member.event?.createdAt?.toISOString?.() || "",
        ip: member.event?.ip || null,
        browserFamily: member.event?.browserFamily || null,
        networkKey: member.event?.networkKey || null,
        fingerprintHash: member.event?.fingerprintHash || null,
        fingerprintSummary: member.event?.fingerprintSummary || null,
      })),
      componentEvidence: {
        anchor: cluster.anchorEvent?.fingerprintComponents || samples[0] || null,
        samples,
      },
      ignoredImpact,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Risk control fingerprint cluster detail error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.riskControl.failedToFetchGroupDetail,
      { status: 500 },
    )
  }
}
