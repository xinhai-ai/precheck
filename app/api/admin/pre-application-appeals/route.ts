import { type NextRequest, NextResponse } from "next/server"
import { Prisma, PreApplicationAppealStatus } from "@prisma/client"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { db } from "@/lib/db"
import { getAppealRejectionSnapshot } from "@/lib/pre-application/appeal-utils"

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const

const appealRecordSelect = {
  id: true,
  preApplicationId: true,
  userId: true,
  status: true,
  reason: true,
  reviewComment: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: userSelect,
  },
  reviewedBy: {
    select: userSelect,
  },
  preApplication: {
    select: {
      id: true,
      status: true,
      queryToken: true,
      registerEmail: true,
      essay: true,
      guidance: true,
      reviewedAt: true,
      reviewedBy: {
        select: userSelect,
      },
      createdAt: true,
      updatedAt: true,
      versions: {
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          essay: true,
          guidance: true,
          reviewedAt: true,
          createdAt: true,
          reviewedBy: {
            select: userSelect,
          },
        },
      },
    },
  },
} satisfies Prisma.PreApplicationAppealSelect

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { searchParams } = request.nextUrl
    const search = (searchParams.get("search") || "").trim()
    const status = searchParams.get("status") || ""
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const where: Prisma.PreApplicationAppealWhereInput = {}

    if (!status) {
      where.status = PreApplicationAppealStatus.PENDING
    }

    if (status) {
      const statuses = status
        .split(",")
        .filter((value) =>
          Object.values(PreApplicationAppealStatus).includes(value as PreApplicationAppealStatus),
        ) as PreApplicationAppealStatus[]

      if (statuses.length === 1) {
        where.status = statuses[0]
      } else if (statuses.length > 1) {
        where.status = { in: statuses }
      }
    }

    if (search) {
      where.OR = [
        { reason: { contains: search, mode: "insensitive" } },
        { reviewComment: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { preApplication: { queryToken: { contains: search, mode: "insensitive" } } },
        { preApplication: { registerEmail: { contains: search, mode: "insensitive" } } },
      ]
    }

    const [records, total, pendingCount, rejectedCount, overriddenCount] = await Promise.all([
      db.preApplicationAppeal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: appealRecordSelect,
      }),
      db.preApplicationAppeal.count({ where }),
      db.preApplicationAppeal.count({ where: { status: PreApplicationAppealStatus.PENDING } }),
      db.preApplicationAppeal.count({ where: { status: PreApplicationAppealStatus.REJECTED } }),
      db.preApplicationAppeal.count({ where: { status: PreApplicationAppealStatus.OVERRIDDEN } }),
    ])

    const normalizedRecords = records.map((record) => {
      const { essay, reviewedBy, versions, ...preApplication } = record.preApplication

      return {
        ...record,
        preApplication,
        rejectionSnapshot: getAppealRejectionSnapshot({
          appealCreatedAt: record.createdAt,
          preApplication: {
            status: record.preApplication.status,
            essay,
            guidance: record.preApplication.guidance,
            reviewedAt: record.preApplication.reviewedAt,
            reviewedBy,
          },
          versions,
        }),
      }
    })

    return NextResponse.json({
      records: normalizedRecords,
      total,
      page,
      limit,
      stats: {
        pending: pendingCount,
        rejected: rejectedCount,
        overridden: overriddenCount,
      },
    })
  } catch (error) {
    console.error("Admin pre-application appeal list error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplicationAppeals.failedToFetch, {
      status: 500,
    })
  }
}
