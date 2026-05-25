import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  ARCHIVED_PRE_APPLICATION_STATUS,
  canViewArchivedPreApplications,
  shouldHidePreApplicationFromAdmin,
} from "@/lib/pre-application/admin-archived-visibility"

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const canViewArchived = canViewArchivedPreApplications(user.role)

    const current = await db.preApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        fingerprintHash: true,
        fingerprintStatus: true,
        fingerprintCollectedAt: true,
      },
    })

    if (!current || shouldHidePreApplicationFromAdmin(current.status, user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    const prisma = db as any
    const latestEvent = await prisma.fingerprintEvent.findFirst({
      where: { preApplicationId: current.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fingerprintHash: true,
        createdAt: true,
      },
    })

    if (!latestEvent && !current.fingerprintHash) {
      return NextResponse.json({
        id: current.id,
        fingerprintHash: null,
        fingerprintStatus: current.fingerprintStatus,
        fingerprintCollectedAt: current.fingerprintCollectedAt,
        relatedUsersCount: 0,
        relatedApplicationsCount: 0,
        relatedUsers: [],
        relatedApplications: [],
        riskCluster: null,
      })
    }

    const clusterMember = latestEvent
      ? await prisma.fingerprintRiskClusterMember.findUnique({
          where: { eventId: latestEvent.id },
          select: {
            clusterId: true,
            cluster: {
              select: {
                id: true,
                riskLevel: true,
                riskScore: true,
                userCount: true,
                applicationCount: true,
                eventCount: true,
                maxSimilarity: true,
                evidenceFlags: true,
                lastSeenAt: true,
                members: {
                  orderBy: { createdAt: "desc" },
                  take: 100,
                  select: {
                    event: {
                      select: {
                        user: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            status: true,
                            latestFingerprintAt: true,
                            createdAt: true,
                          },
                        },
                        preApplication: {
                          select: {
                            id: true,
                            registerEmail: true,
                            essay: true,
                            status: true,
                            queryToken: true,
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
            },
          },
        })
      : null

    if (clusterMember?.cluster) {
      const siblingEvents = clusterMember.cluster.members
        .map((member: any) => member.event)
        .filter(Boolean)
      const visibleSiblingEvents = siblingEvents.filter(
        (event: any) =>
          !event.preApplication ||
          canViewArchived ||
          event.preApplication.status !== ARCHIVED_PRE_APPLICATION_STATUS,
      )
      const relatedUsers = uniqueById(
        siblingEvents
          .map((event: any) => event.user)
          .filter((item: unknown): item is { id: string } => Boolean(item && (item as any).id)),
      )
      const relatedApplications = uniqueById(
        visibleSiblingEvents
          .map((event: any) => event.preApplication)
          .filter((item: unknown): item is { id: string } => Boolean(item && (item as any).id)),
      )
      const listedRelatedApplications = relatedApplications.filter((item) => item.id !== current.id)

      return NextResponse.json({
        id: current.id,
        fingerprintHash: current.fingerprintHash || latestEvent?.fingerprintHash || null,
        fingerprintStatus: current.fingerprintStatus,
        fingerprintCollectedAt: current.fingerprintCollectedAt,
        relatedUsersCount: relatedUsers.length,
        relatedApplicationsCount: relatedApplications.length,
        relatedUsers: relatedUsers.slice(0, 20),
        relatedApplications: listedRelatedApplications.slice(0, 20),
        riskCluster: {
          clusterId: clusterMember.clusterId,
          riskLevel: clusterMember.cluster.riskLevel,
          riskScore: clusterMember.cluster.riskScore,
          userCount: clusterMember.cluster.userCount,
          applicationCount: clusterMember.cluster.applicationCount,
          eventCount: clusterMember.cluster.eventCount,
          maxSimilarity: clusterMember.cluster.maxSimilarity,
          evidenceFlags: clusterMember.cluster.evidenceFlags || [],
          lastSeenAt: clusterMember.cluster.lastSeenAt,
        },
      })
    }

    if (!current.fingerprintHash) {
      return NextResponse.json({
        id: current.id,
        fingerprintHash: latestEvent?.fingerprintHash || null,
        fingerprintStatus: current.fingerprintStatus,
        fingerprintCollectedAt: current.fingerprintCollectedAt,
        relatedUsersCount: 0,
        relatedApplicationsCount: 0,
        relatedUsers: [],
        relatedApplications: [],
        riskCluster: null,
      })
    }

    const visibleRelatedApplicationsWhere = {
      fingerprintHash: current.fingerprintHash,
      ...(canViewArchived ? {} : { status: { not: ARCHIVED_PRE_APPLICATION_STATUS } }),
    }

    const [relatedUsers, relatedApplications, relatedUsersCount, relatedApplicationsCount] =
      await Promise.all([
        db.user.findMany({
          where: { latestFingerprintHash: current.fingerprintHash },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            latestFingerprintAt: true,
            createdAt: true,
          },
        }),
        db.preApplication.findMany({
          where: {
            ...visibleRelatedApplicationsWhere,
            id: { not: current.id },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            registerEmail: true,
            essay: true,
            status: true,
            queryToken: true,
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
        db.user.count({
          where: { latestFingerprintHash: current.fingerprintHash },
        }),
        db.preApplication.count({
          where: visibleRelatedApplicationsWhere,
        }),
      ])

    return NextResponse.json({
      id: current.id,
      fingerprintHash: current.fingerprintHash,
      fingerprintStatus: current.fingerprintStatus,
      fingerprintCollectedAt: current.fingerprintCollectedAt,
      relatedUsersCount,
      relatedApplicationsCount,
      relatedUsers,
      relatedApplications,
      riskCluster: null,
    })
  } catch (error) {
    console.error("Admin pre-application fingerprint detail error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.failedToFetch, {
      status: 500,
    })
  }
}
