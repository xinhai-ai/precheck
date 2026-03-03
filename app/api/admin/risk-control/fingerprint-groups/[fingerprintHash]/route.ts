import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { type FingerprintRiskGroupDetailResponse, computeRiskLevel } from "@/lib/risk-control/fingerprint-risk"

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
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { fingerprintHash: rawFingerprintHash } = await context.params
    const fingerprintHash = decodeURIComponent(rawFingerprintHash || "").trim()
    if (!fingerprintHash) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, { status: 400 })
    }

    const ignoredRows = await db.riskIgnoredUser.findMany({
      select: { userId: true },
    })
    const ignoredUserIds = ignoredRows.map((row) => row.userId)
    const eventWhere = buildEventWhere(fingerprintHash, ignoredUserIds)

    const [userSeenRows, applicationSeenRows, relatedApplications, recentEvents, lastSeenEvent] =
      await Promise.all([
        db.fingerprintEvent.groupBy({
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
        db.fingerprintEvent.groupBy({
          by: ["preApplicationId"],
          where: {
            ...eventWhere,
            preApplicationId: { not: null },
          },
          _count: { preApplicationId: true },
        }),
        db.preApplication.findMany({
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
        db.fingerprintEvent.findMany({
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
            createdAt: true,
            userId: true,
            preApplicationId: true,
          },
        }),
        db.fingerprintEvent.findFirst({
          where: eventWhere,
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ])

    const userIds = userSeenRows
      .map((row) => row.userId)
      .filter((value): value is string => Boolean(value))

    const [users, latestIpEntries] = userIds.length
      ? await Promise.all([
          db.user.findMany({
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
              const latest = await db.fingerprintEvent.findFirst({
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
          await db.fingerprintEvent.findMany({
            where: {
              fingerprintHash,
              userId: { in: ignoredUserIds },
            },
            distinct: ["userId"],
            select: { userId: true },
          })
        ).filter((row) => row.userId !== null).length
      : 0

    const response: FingerprintRiskGroupDetailResponse = {
      summary: {
        fingerprintHash,
        userCount: relatedUsers.length,
        applicationCount: applicationSeenRows.length,
        lastSeenAt: lastSeenEvent?.createdAt?.toISOString() || null,
        riskLevel: computeRiskLevel(relatedUsers.length, applicationSeenRows.length),
      },
      relatedUsers,
      relatedApplications: relatedApplications.map((item) => ({
        id: item.id,
        status: item.status,
        registerEmail: item.registerEmail,
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
    return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.failedToFetchGroupDetail, {
      status: 500,
    })
  }
}
