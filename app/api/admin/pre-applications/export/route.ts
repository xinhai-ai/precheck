import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  ARCHIVED_PRE_APPLICATION_STATUS,
  canViewArchivedPreApplications,
  filterAdminVisiblePreApplicationStatuses,
} from "@/lib/pre-application/admin-archived-visibility"

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n")
}

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

    const canViewArchived = canViewArchivedPreApplications(user.role)
    const { searchParams } = request.nextUrl
    const search = (searchParams.get("search") || "").trim()
    const status = searchParams.get("status") || ""
    const registerEmail = (searchParams.get("registerEmail") || "").trim()
    const queryToken = (searchParams.get("queryToken") || "").trim()
    const reviewRound = searchParams.get("reviewRound") || ""
    const inviteStatus = searchParams.get("inviteStatus") || ""
    const formalFeedbackStatus = searchParams.get("formalFeedbackStatus") || ""

    const where: {
      status?: PreApplicationStatus | { in: PreApplicationStatus[] } | { not: PreApplicationStatus }
      registerEmail?: { contains: string; mode: "insensitive" }
      queryToken?: { contains: string; mode: "insensitive" }
      resubmitCount?: number
      codeSent?: boolean
      formalApplicationApprovedFeedbackAt?: null | { not: null }
      OR?: Array<Record<string, unknown>>
    } = {}

    if (!status && !canViewArchived) {
      where.status = { not: ARCHIVED_PRE_APPLICATION_STATUS }
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

    if (registerEmail) where.registerEmail = { contains: registerEmail, mode: "insensitive" }
    if (queryToken) where.queryToken = { contains: queryToken, mode: "insensitive" }

    if (reviewRound) {
      const round = Number.parseInt(reviewRound)
      if (!Number.isNaN(round) && round >= 1) where.resubmitCount = round - 1
    }

    if (inviteStatus === "issued") {
      where.codeSent = true
      where.status = "APPROVED"
    } else if (inviteStatus === "none") {
      where.codeSent = false
      where.status = "APPROVED"
    }

    if (formalFeedbackStatus === "confirmed") {
      where.status = "APPROVED"
      where.formalApplicationApprovedFeedbackAt = { not: null }
    } else if (formalFeedbackStatus === "unconfirmed") {
      where.status = "APPROVED"
      where.formalApplicationApprovedFeedbackAt = null
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

    const records = await db.preApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        registerEmail: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        codeSent: true,
        formalApplicationApprovedFeedbackAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    const header = [
      "id",
      "userId",
      "userEmail",
      "userName",
      "registerEmail",
      "status",
      "createdAt",
      "reviewedAt",
      "codeSent",
      "formalApplicationApprovedFeedbackAt",
    ]

    const rows: unknown[][] = [
      header,
      ...records.map((record) => [
        record.id,
        record.userId,
        record.user?.email || "",
        record.user?.name || "",
        record.registerEmail,
        record.status,
        record.createdAt.toISOString(),
        record.reviewedAt?.toISOString() || "",
        record.codeSent ? "true" : "false",
        record.formalApplicationApprovedFeedbackAt?.toISOString() || "",
      ]),
    ]

    const csv = toCsv(rows)
    const filename = `pre-applications-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Admin pre-application export error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.failedToFetch, {
      status: 500,
    })
  }
}
