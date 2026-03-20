import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  computeFingerprintRiskAssessment,
  type FingerprintRiskGroupItem,
  sanitizeRiskSort,
} from "@/lib/risk-control/fingerprint-risk"

type RiskGroupRow = {
  fingerprintHash: string
  userCount: number
  applicationCount: number
  lastSeenAt: Date
}

type SearchHashRow = {
  fingerprintHash: string
}

type FingerprintSupportEvent = {
  fingerprintHash: string | null
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
    const prisma = db

    const { searchParams } = request.nextUrl
    const page = clampPage(searchParams.get("page"), 1)
    const limit = clampLimit(searchParams.get("limit"), 20)
    const search = (searchParams.get("search") || "").trim()
    const riskLevelFilter = (searchParams.get("riskLevel") || "").trim().toUpperCase()
    const { sortBy, sortOrder } = sanitizeRiskSort(
      searchParams.get("sortBy"),
      searchParams.get("sortOrder"),
    )
    const ignoredRows = await prisma.riskIgnoredUser.findMany({
      select: { userId: true },
    })
    const ignoredUserIds = ignoredRows.map((row) => row.userId)

    const rows = await prisma.$queryRaw<RiskGroupRow[]>`
      WITH filtered_events AS (
        SELECT fe.*
        FROM "FingerprintEvent" fe
        WHERE fe."fingerprintHash" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "RiskIgnoredUser" ri
            WHERE ri."userId" = fe."userId"
          )
      ),
      grouped AS (
        SELECT
          fe."fingerprintHash" AS "fingerprintHash",
          COUNT(DISTINCT fe."userId")::int AS "userCount",
          COUNT(DISTINCT fe."preApplicationId")::int AS "applicationCount",
          MAX(fe."createdAt") AS "lastSeenAt"
        FROM filtered_events fe
        GROUP BY fe."fingerprintHash"
      )
      SELECT
        g."fingerprintHash",
        g."userCount",
        g."applicationCount",
        g."lastSeenAt"
      FROM grouped g
      WHERE (g."userCount" >= 2 OR g."applicationCount" >= 2)
    `

    const fingerprintHashes = rows.map((row) => row.fingerprintHash)
    const supportEvents = fingerprintHashes.length
      ? await prisma.fingerprintEvent.findMany({
          where: {
            fingerprintHash: { in: fingerprintHashes },
            ...(ignoredUserIds.length
              ? {
                  OR: [{ userId: null }, { userId: { notIn: ignoredUserIds } }],
                }
              : {}),
          },
          select: {
            fingerprintHash: true,
            browserFamily: true,
            networkKey: true,
            createdAt: true,
            userId: true,
            preApplicationId: true,
            eventType: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : []

    const eventsByHash = new Map<string, FingerprintSupportEvent[]>()
    for (const event of supportEvents) {
      if (!event.fingerprintHash) continue
      const existing = eventsByHash.get(event.fingerprintHash) || []
      existing.push(event)
      eventsByHash.set(event.fingerprintHash, existing)
    }

    const enriched: FingerprintRiskGroupItem[] = rows.map((row) => {
      const assessment = buildRiskSignals(
        eventsByHash.get(row.fingerprintHash) || [],
        Number(row.userCount),
        Number(row.applicationCount),
      )

      return {
        fingerprintHash: row.fingerprintHash,
        userCount: Number(row.userCount),
        applicationCount: Number(row.applicationCount),
        lastSeenAt: row.lastSeenAt.toISOString(),
        riskLevel: assessment.riskLevel,
        browserConfidence: assessment.browserConfidence,
        evidenceFlags: assessment.evidenceFlags,
        riskExplanation: assessment.riskExplanation,
      }
    })

    const searchHashes =
      search.length > 0
        ? await prisma.$queryRaw<SearchHashRow[]>`
            WITH filtered_events AS (
              SELECT fe.*
              FROM "FingerprintEvent" fe
              WHERE fe."fingerprintHash" IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1
                  FROM "RiskIgnoredUser" ri
                  WHERE ri."userId" = fe."userId"
                )
            )
            SELECT DISTINCT fe."fingerprintHash"
            FROM filtered_events fe
            LEFT JOIN "User" u ON u."id" = fe."userId"
            LEFT JOIN "PreApplication" pa ON pa."id" = fe."preApplicationId"
            WHERE u."email" ILIKE ${`%${search}%`}
               OR pa."registerEmail" ILIKE ${`%${search}%`}
          `
        : []

    const searchHashSet = new Set(searchHashes.map((item) => item.fingerprintHash))
    const searchLower = search.toLowerCase()

    const scopedItems =
      search.length > 0
        ? enriched.filter(
            (item) =>
              item.fingerprintHash.toLowerCase().includes(searchLower) ||
              searchHashSet.has(item.fingerprintHash),
          )
        : enriched

    const high = scopedItems.filter((item) => item.riskLevel === "HIGH").length
    const medium = scopedItems.filter((item) => item.riskLevel === "MEDIUM").length

    const riskFiltered =
      riskLevelFilter === "HIGH" || riskLevelFilter === "MEDIUM" || riskLevelFilter === "LOW"
        ? scopedItems.filter((item) => item.riskLevel === riskLevelFilter)
        : scopedItems

    riskFiltered.sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1
      if (sortBy === "lastSeenAt") {
        return (new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()) * direction
      }
      return (a[sortBy] - b[sortBy]) * direction
    })

    const total = riskFiltered.length
    const start = (page - 1) * limit
    const items = riskFiltered.slice(start, start + limit)
    const ignoredUsers = ignoredRows.length

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      stats: {
        high,
        medium,
        ignoredUsers,
      },
    })
  } catch (error) {
    console.error("Risk control fingerprint groups error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.failedToFetchGroups, {
      status: 500,
    })
  }
}
