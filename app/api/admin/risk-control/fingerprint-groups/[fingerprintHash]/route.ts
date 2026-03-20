import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  type FingerprintRiskGroupDetailResponse,
  computeFingerprintRiskAssessment,
} from "@/lib/risk-control/fingerprint-risk"

type FingerprintSupportEvent = {
  browserFamily: string | null
  networkKey: string | null
  createdAt: Date
  userId: string | null
  preApplicationId: string | null
  eventType: string
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function getPrimaryBrowserFamily(events: FingerprintSupportEvent[]): string | null {
  const counts = new Map<string, number>()

  for (const event of events) {
    const browserFamily = event.browserFamily?.trim()
    if (!browserFamily) continue
    counts.set(browserFamily, (counts.get(browserFamily) || 0) + 1)
  }

  let topFamily: string | null = null
  let topCount = 0

  for (const [family, count] of counts.entries()) {
    if (count > topCount) {
      topFamily = family
      topCount = count
    }
  }

  return topFamily
}

function buildRiskSignals(
  events: FingerprintSupportEvent[],
  userCount: number,
  applicationCount: number,
) {
  const recentCutoff = Date.now() - ONE_DAY_MS
  const recentEvents = events.filter((event) => event.createdAt.getTime() >= recentCutoff)
  const recentDistinctUsers = new Set(
    recentEvents.map((event) => event.userId).filter((value): value is string => Boolean(value)),
  ).size
  const recentDistinctApplications = new Set(
    recentEvents
      .map((event) => event.preApplicationId)
      .filter((value): value is string => Boolean(value)),
  ).size

  const networkCounts = new Map<string, number>()
  for (const event of recentEvents) {
    const networkKey = event.networkKey?.trim()
    if (!networkKey) continue
    networkCounts.set(networkKey, (networkCounts.get(networkKey) || 0) + 1)
  }

  let overlappingNetworkCount = 0
  for (const count of networkCounts.values()) {
    if (count > overlappingNetworkCount) {
      overlappingNetworkCount = count
    }
  }

  const eventTypesByUser = new Map<string, Set<string>>()
  for (const event of events) {
    if (!event.userId) continue
    const existing = eventTypesByUser.get(event.userId) || new Set<string>()
    existing.add(event.eventType)
    eventTypesByUser.set(event.userId, existing)
  }

  const crossEventUserCount = Array.from(eventTypesByUser.values()).filter(
    (types) => types.size >= 2,
  ).length

  return computeFingerprintRiskAssessment({
    primaryBrowserFamily: getPrimaryBrowserFamily(recentEvents.length ? recentEvents : events),
    userCount,
    applicationCount,
    recentDistinctUsers,
    recentDistinctApplications,
    overlappingNetworkCount,
    crossEventUserCount,
  })
}

function buildEventWhere(fingerprintHash: string, ignoredUserIds: string[]) {
  if (!ignoredUserIds.length) {
    return { fingerprintHash }
  }

  return {
    fingerprintHash,
    OR: [{ userId: null }, { userId: { notIn: ignoredUserIds } }],
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fingerprintHash: string }> },
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
    const prisma = db

    const { fingerprintHash: rawFingerprintHash } = await context.params
    const fingerprintHash = decodeURIComponent(rawFingerprintHash || "").trim()
    if (!fingerprintHash) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, { status: 400 })
    }

    const ignoredRows = await prisma.riskIgnoredUser.findMany({
      select: { userId: true },
    })
    const ignoredUserIds = ignoredRows.map((row) => row.userId)
    const eventWhere = buildEventWhere(fingerprintHash, ignoredUserIds)

    const [
      userSeenRows,
      applicationSeenRows,
      relatedApplications,
      recentEvents,
      lastSeenEvent,
      supportEvents,
    ] = await Promise.all([
      prisma.fingerprintEvent.groupBy({
        by: ["userId"],
        where: {
          fingerprintHash,
          userId: {
            not: null,
            ...(ignoredUserIds.length ? { notIn: ignoredUserIds } : {}),
          },
        },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.fingerprintEvent.groupBy({
        by: ["preApplicationId"],
        where: {
          ...eventWhere,
          preApplicationId: { not: null },
        },
        _count: { preApplicationId: true },
      }),
      prisma.preApplication.findMany({
        where: {
          fingerprintHash,
          ...(ignoredUserIds.length
            ? {
                OR: [{ userId: null }, { userId: { notIn: ignoredUserIds } }],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
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
      }),
      prisma.fingerprintEvent.findMany({
        where: eventWhere,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          eventType: true,
          status: true,
          failureReason: true,
          ip: true,
          userAgent: true,
          browserFamily: true,
          networkKey: true,
          createdAt: true,
          userId: true,
          preApplicationId: true,
        },
      }),
      prisma.fingerprintEvent.findFirst({
        where: eventWhere,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.fingerprintEvent.findMany({
        where: eventWhere,
        select: {
          browserFamily: true,
          networkKey: true,
          createdAt: true,
          userId: true,
          preApplicationId: true,
          eventType: true,
        },
      }),
    ])

    const userIds = userSeenRows
      .map((row) => row.userId)
      .filter((value): value is string => Boolean(value))

    const [users, latestIpEntries] = userIds.length
      ? await Promise.all([
          prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          }),
          Promise.all(
            userIds.map(async (id) => {
              const latest = await prisma.fingerprintEvent.findFirst({
                where: {
                  fingerprintHash,
                  userId: id,
                },
                orderBy: { createdAt: "desc" },
                select: { ip: true },
              })
              return [id, latest?.ip || null] as const
            }),
          ),
        ])
      : [[], []]

    const userMap = new Map(users.map((item) => [item.id, item]))
    const latestIpMap = new Map(latestIpEntries)
    const relatedUsers = userSeenRows
      .map((row) => {
        if (!row.userId) return null
        const targetUser = userMap.get(row.userId)
        if (!targetUser) return null

        return {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          status: targetUser.status,
          firstSeenAt: row._min.createdAt?.toISOString() || null,
          lastSeenAt: row._max.createdAt?.toISOString() || null,
          lastSeenIp: latestIpMap.get(targetUser.id) || null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0
        return bt - at
      })

    const ignoredImpact = ignoredUserIds.length
      ? (
          await prisma.fingerprintEvent.findMany({
            where: {
              fingerprintHash,
              userId: { in: ignoredUserIds },
            },
            distinct: ["userId"],
            select: { userId: true },
          })
        ).filter((row) => row.userId !== null).length
      : 0

    const assessment = buildRiskSignals(
      supportEvents,
      relatedUsers.length,
      applicationSeenRows.length,
    )

    const response: FingerprintRiskGroupDetailResponse = {
      summary: {
        fingerprintHash,
        userCount: relatedUsers.length,
        applicationCount: applicationSeenRows.length,
        lastSeenAt: lastSeenEvent?.createdAt?.toISOString() || null,
        riskLevel: assessment.riskLevel,
        browserConfidence: assessment.browserConfidence,
        evidenceFlags: assessment.evidenceFlags,
        riskExplanation: assessment.riskExplanation,
      },
      relatedUsers,
      relatedApplications: relatedApplications.map((item) => ({
        id: item.id,
        status: item.status,
        registerEmail: item.registerEmail,
        essay: item.essay,
        createdAt: item.createdAt.toISOString(),
        user: item.user,
      })),
      recentEvents: recentEvents.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      ignoredImpact,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Risk control fingerprint group detail error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.riskControl.failedToFetchGroupDetail,
      {
        status: 500,
      },
    )
  }
}
