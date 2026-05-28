import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { PreApplicationAppealStatus, PreApplicationStatus, type Prisma } from "@prisma/client"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { SHADOW_HIDDEN_STATUS } from "@/lib/pre-application/shadowban"
import {
  ARCHIVED_PRE_APPLICATION_STATUS,
  canViewArchivedPreApplications,
  filterAdminVisiblePreApplicationStatuses,
} from "@/lib/pre-application/admin-archived-visibility"

export async function GET(request: NextRequest) {
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

    const database = db
    const canViewArchived = canViewArchivedPreApplications(user.role)
    const { searchParams } = request.nextUrl
    const search = (searchParams.get("search") || "").trim()
    const status = searchParams.get("status") || ""
    const registerEmail = (searchParams.get("registerEmail") || "").trim()
    const queryToken = (searchParams.get("queryToken") || "").trim()
    const reviewRound = searchParams.get("reviewRound") || ""
    const inviteStatus = searchParams.get("inviteStatus") || ""
    const formalFeedbackStatus = searchParams.get("formalFeedbackStatus") || ""
    const sortByParam = searchParams.get("sortBy") || "createdAt"
    const sortOrderParam = searchParams.get("sortOrder")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit
    const allowedSortBy = new Set([
      "createdAt",
      "updatedAt",
      "status",
      "registerEmail",
      "resubmitCount",
      "inviteCodeId",
      "codeSent",
    ])
    const sortBy = allowedSortBy.has(sortByParam) ? sortByParam : "createdAt"
    const sortOrder = sortOrderParam === "asc" ? "asc" : "desc"

    const where: Prisma.PreApplicationWhereInput = {}

    if (!status) {
      where.status = canViewArchived
        ? { not: SHADOW_HIDDEN_STATUS }
        : { notIn: [SHADOW_HIDDEN_STATUS, ARCHIVED_PRE_APPLICATION_STATUS] }
    }

    let requestedStatuses: PreApplicationStatus[] = []
    if (status) {
      requestedStatuses = filterAdminVisiblePreApplicationStatuses(
        status
          .split(",")
          .filter((s) =>
            Object.values(PreApplicationStatus).includes(s as PreApplicationStatus),
          ) as PreApplicationStatus[],
        user.role,
      ) as PreApplicationStatus[]
      if (requestedStatuses.length === 1) {
        where.status = requestedStatuses[0]
      } else if (requestedStatuses.length > 1) {
        where.status = { in: requestedStatuses }
      } else {
        where.status = { in: requestedStatuses }
      }
    }

    if (registerEmail) {
      where.registerEmail = { contains: registerEmail, mode: "insensitive" }
    }

    if (queryToken) {
      where.queryToken = { contains: queryToken, mode: "insensitive" }
    }

    if (reviewRound) {
      const round = Number.parseInt(reviewRound)
      if (!Number.isNaN(round) && round >= 1) {
        where.resubmitCount = round - 1
      }
    }

    if (inviteStatus === "issued") {
      where.codeSent = true
      where.status = "APPROVED" as PreApplicationStatus
    } else if (inviteStatus === "none") {
      where.codeSent = false
      where.status = "APPROVED" as PreApplicationStatus
    }

    if (formalFeedbackStatus === "confirmed") {
      where.status = "APPROVED" as PreApplicationStatus
      Object.assign(where, { formalApplicationApprovedFeedbackAt: { not: null } })
    } else if (formalFeedbackStatus === "unconfirmed") {
      where.status = "APPROVED" as PreApplicationStatus
      Object.assign(where, { formalApplicationApprovedFeedbackAt: null })
    }

    if (search) {
      where.OR = [
        { queryToken: { contains: search, mode: "insensitive" as const } },
        { user: { name: { contains: search, mode: "insensitive" as const } } },
        { user: { email: { contains: search, mode: "insensitive" as const } } },
      ]
    }

    if (status && requestedStatuses.length === 0) {
      where.status = { in: [] }
    }

    const preApplicationSelect = {
      id: true,
      essay: true,
      source: true,
      sourceDetail: true,
      registerEmail: true,
      queryToken: true,
      group: true,
      status: true,
      guidance: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
      resubmitCount: true,
      codeSent: true,
      codeSentAt: true,
      formalApplicationApprovedFeedbackAt: true,
      user: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      inviteCode: {
        select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
      },
      appeals: {
        where: { status: PreApplicationAppealStatus.PENDING },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          source: true,
          createdAt: true,
        },
      },
      versions: {
        orderBy: { version: "desc" as const },
        take: 1,
        select: { createdAt: true },
      },
    } satisfies Prisma.PreApplicationSelect

    const recordsPromise =
      sortBy === "createdAt"
        ? database.preApplicationVersion
            .groupBy({
              by: ["preApplicationId"],
              where: { preApplication: where },
              _max: { createdAt: true },
              orderBy: { _max: { createdAt: sortOrder } },
              skip,
              take: limit,
            })
            .then(async (groups) => {
              if (groups.length === 0) {
                return []
              }

              const idOrder = new Map(groups.map((group, index) => [group.preApplicationId, index]))
              const ids = groups.map((group) => group.preApplicationId)
              const rows = await database.preApplication.findMany({
                where: { id: { in: ids } },
                select: preApplicationSelect,
              })

              rows.sort(
                (a, b) =>
                  (idOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
                  (idOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
              )

              return rows
            })
        : database.preApplication.findMany({
            where,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: preApplicationSelect,
          })

    const [
      records,
      total,
      pendingCount,
      approvedCount,
      rejectedCount,
      disputedCount,
      archivedCount,
      shadowHiddenCount,
    ] = await Promise.all([
      recordsPromise,
      database.preApplication.count({ where }),
      database.preApplication.count({ where: { status: "PENDING" } }),
      database.preApplication.count({ where: { status: "APPROVED" } }),
      database.preApplication.count({ where: { status: "REJECTED" } }),
      database.preApplication.count({ where: { status: "DISPUTED" } }),
      canViewArchived
        ? database.preApplication.count({ where: { status: "ARCHIVED" } })
        : Promise.resolve(0),
      database.preApplication.count({ where: { status: SHADOW_HIDDEN_STATUS } }),
    ])

    const enrichedRecords = records.map((record) => {
      const reviewRound = record.resubmitCount + 1
      const latestVersionCreatedAt = record.versions[0]?.createdAt ?? record.createdAt
      const pendingAppeal = record.appeals[0] ?? null
      const { versions, appeals, ...rest } = record
      return { ...rest, reviewRound, latestVersionCreatedAt, pendingAppeal }
    })

    return NextResponse.json({
      records: enrichedRecords,
      total,
      page,
      limit,
      stats: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        disputed: disputedCount,
        archived: archivedCount,
        shadowHidden: shadowHiddenCount,
      },
    })
  } catch (error) {
    console.error("Admin pre-application list error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.failedToFetch, {
      status: 500,
    })
  }
}
