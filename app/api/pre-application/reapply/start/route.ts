import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    if (!user.preApplicationReapplyEligibleAt) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.reapplyNotAvailable, {
        status: 409,
      })
    }

    const latestPreApplication = await db.preApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    })

    if (!latestPreApplication || latestPreApplication.status !== PreApplicationStatus.ARCHIVED) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.reapplyNotAvailable, {
        status: 409,
      })
    }

    if (user.preApplicationReapplyStartedAt) {
      return NextResponse.json({
        success: true,
        reapply: {
          eligible: true,
          started: true,
          canStart: false,
          eligibleAt: user.preApplicationReapplyEligibleAt.toISOString(),
          startedAt: user.preApplicationReapplyStartedAt.toISOString(),
        },
      })
    }

    const startedAt = new Date()
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { preApplicationReapplyStartedAt: startedAt },
      select: {
        id: true,
        preApplicationReapplyEligibleAt: true,
        preApplicationReapplyStartedAt: true,
      },
    })

    await writeAuditLog(db, {
      action: "PRE_APPLICATION_REAPPLY_START",
      entityType: "USER",
      entityId: user.id,
      actor: user,
      before: {
        preApplicationReapplyEligibleAt: user.preApplicationReapplyEligibleAt,
        preApplicationReapplyStartedAt: user.preApplicationReapplyStartedAt,
      },
      after: {
        preApplicationReapplyEligibleAt: updatedUser.preApplicationReapplyEligibleAt,
        preApplicationReapplyStartedAt: updatedUser.preApplicationReapplyStartedAt,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      reapply: {
        eligible: Boolean(updatedUser.preApplicationReapplyEligibleAt),
        started: Boolean(updatedUser.preApplicationReapplyStartedAt),
        canStart: false,
        eligibleAt: updatedUser.preApplicationReapplyEligibleAt?.toISOString() ?? null,
        startedAt: updatedUser.preApplicationReapplyStartedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Start pre-application reapply error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToStartReapply, {
      status: 500,
    })
  }
}
