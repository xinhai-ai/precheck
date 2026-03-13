import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  type FingerprintRiskGroupItem,
  computeRiskLevel,
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

    const { searchParams } = request.nextUrl
    const page = clampPage(searchParams.get("page"), 1)
    const limit = clampLimit(searchParams.get("limit"), 20)
    const search = (searchParams.get("search") || "").trim()
    const riskLevelFilter = (searchParams.get("riskLevel") || "").trim().toUpperCase()
    const { sortBy, sortOrder } = sanitizeRiskSort(
      searchParams.get("sortBy"),
      searchParams.get("sortOrder"),
    )

    const rows = await db.$queryRaw<RiskGroupRow[]>`
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

    const enriched: FingerprintRiskGroupItem[] = rows.map((row) => ({
      fingerprintHash: row.fingerprintHash,
      userCount: Number(row.userCount),
      applicationCount: Number(row.applicationCount),
      lastSeenAt: row.lastSeenAt.toISOString(),
      riskLevel: computeRiskLevel(Number(row.userCount), Number(row.applicationCount)),
    }))

    const searchHashes =
      search.length > 0
        ? await db.$queryRaw<SearchHashRow[]>`
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
        return (
          (new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()) * direction
        )
      }
      return (a[sortBy] - b[sortBy]) * direction
    })

    const total = riskFiltered.length
    const start = (page - 1) * limit
    const items = riskFiltered.slice(start, start + limit)
    const ignoredUsers = await db.riskIgnoredUser.count()

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
