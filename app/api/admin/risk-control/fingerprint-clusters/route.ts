import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import type { RiskLevel } from "@/lib/risk-control/fingerprint-risk"

type FingerprintRiskClusterItem = {
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

type FingerprintRiskClusterListResponse = {
  items: FingerprintRiskClusterItem[]
  total: number
  page: number
  limit: number
  stats: {
    high: number
    medium: number
    ignoredUsers: number
  }
}

type FingerprintRiskClusterSortBy = "riskScore" | "lastSeenAt" | "userCount" | "applicationCount"

function clampPage(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10)
  if (Number.isNaN(parsed) || parsed < 1) return fallback
  return parsed
}

function clampLimit(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10)
  if (Number.isNaN(parsed) || parsed < 1) return fallback
  return Math.min(parsed, 100)
}

function sanitizeSort(
  sortBy: string | null,
  sortOrder: string | null,
): { sortBy: FingerprintRiskClusterSortBy; sortOrder: "asc" | "desc" } {
  const allowed = new Set<FingerprintRiskClusterSortBy>([
    "riskScore",
    "lastSeenAt",
    "userCount",
    "applicationCount",
  ])
  const normalizedSortBy = sortBy?.trim() as FingerprintRiskClusterSortBy | undefined
  const normalizedSortOrder = sortOrder?.trim().toLowerCase()

  return {
    sortBy: normalizedSortBy && allowed.has(normalizedSortBy) ? normalizedSortBy : "lastSeenAt",
    sortOrder: normalizedSortOrder === "asc" ? "asc" : "desc",
  }
}

function buildSearchWhere(search: string) {
  if (!search) return {}

  return {
    OR: [
      { id: { contains: search, mode: "insensitive" } },
      {
        members: {
          some: {
            event: {
              OR: [
                { fingerprintHash: { contains: search, mode: "insensitive" } },
                { user: { email: { contains: search, mode: "insensitive" } } },
                { preApplication: { registerEmail: { contains: search, mode: "insensitive" } } },
              ],
            },
          },
        },
      },
    ],
  }
}

export async function GET(request: NextRequest) {
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

    const prisma = db as any
    const { searchParams } = request.nextUrl
    const page = clampPage(searchParams.get("page"), 1)
    const limit = clampLimit(searchParams.get("limit"), 20)
    const search = (searchParams.get("search") || "").trim()
    const riskLevel = (searchParams.get("riskLevel") || "").trim().toUpperCase()
    const { sortBy, sortOrder } = sanitizeSort(
      searchParams.get("sortBy"),
      searchParams.get("sortOrder"),
    )
    const where = {
      ...buildSearchWhere(search),
      ...(riskLevel === "HIGH" || riskLevel === "MEDIUM" || riskLevel === "LOW"
        ? { riskLevel }
        : {}),
    }

    const [clusters, total, high, medium, ignoredUsers] = await Promise.all([
      prisma.fingerprintRiskCluster.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
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
        },
      }),
      prisma.fingerprintRiskCluster.count({ where }),
      prisma.fingerprintRiskCluster.count({
        where: { ...buildSearchWhere(search), riskLevel: "HIGH" },
      }),
      prisma.fingerprintRiskCluster.count({
        where: { ...buildSearchWhere(search), riskLevel: "MEDIUM" },
      }),
      prisma.riskIgnoredUser.count(),
    ])

    const response: FingerprintRiskClusterListResponse = {
      items: clusters.map((cluster: any) => ({
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
      })),
      total,
      page,
      limit,
      stats: {
        high,
        medium,
        ignoredUsers,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Risk control fingerprint clusters error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.failedToFetchGroups, {
      status: 500,
    })
  }
}
