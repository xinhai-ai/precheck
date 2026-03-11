import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params

    const targetUser = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        preApplicationReapplyEligibleAt: true,
        preApplicationReapplyStartedAt: true,
      },
    })

    if (!targetUser) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.users.userNotFound, { status: 404 })
    }

    if (targetUser.preApplicationReapplyEligibleAt) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.users.reapplyAlreadyUnlocked, {
        status: 409,
      })
    }

    const latestPreApplication = await db.preApplication.findFirst({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        version: true,
        essay: true,
        source: true,
        sourceDetail: true,
        registerEmail: true,
        group: true,
        guidance: true,
        reviewedAt: true,
        reviewedById: true,
        codeSent: true,
        codeSentAt: true,
      },
    })

    if (!latestPreApplication || latestPreApplication.status !== PreApplicationStatus.APPROVED) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.users.reapplyNotAvailable, {
        status: 409,
      })
    }

    const now = new Date()
    const newVersion = latestPreApplication.version + 1

    const result = await db.$transaction(async (tx) => {
      await tx.preApplicationVersion.create({
        data: {
          preApplicationId: latestPreApplication.id,
          version: newVersion,
          essay: latestPreApplication.essay,
          source: latestPreApplication.source,
          sourceDetail: latestPreApplication.sourceDetail,
          registerEmail: latestPreApplication.registerEmail,
          group: latestPreApplication.group,
          status: PreApplicationStatus.ARCHIVED,
          guidance: latestPreApplication.guidance,
          reviewedAt: now,
          reviewedById: user.id,
        },
      })

      const archived = await tx.preApplication.update({
        where: { id: latestPreApplication.id },
        data: {
          status: PreApplicationStatus.ARCHIVED,
          version: newVersion,
        },
        select: {
          id: true,
          status: true,
          version: true,
        },
      })

      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          preApplicationReapplyEligibleAt: now,
          preApplicationReapplyStartedAt: null,
        },
        select: {
          id: true,
          preApplicationReapplyEligibleAt: true,
          preApplicationReapplyStartedAt: true,
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_REAPPLY_RESET",
        entityType: "PRE_APPLICATION",
        entityId: latestPreApplication.id,
        actor: user,
        before: latestPreApplication,
        after: archived,
        metadata: {
          targetUserId: id,
          reapplyEligibleAt: now.toISOString(),
        },
        request,
      })

      return { archived, updatedUser }
    })

    return NextResponse.json({
      success: true,
      preApplication: result.archived,
      reapply: {
        eligible: Boolean(result.updatedUser.preApplicationReapplyEligibleAt),
        started: Boolean(result.updatedUser.preApplicationReapplyStartedAt),
        eligibleAt: result.updatedUser.preApplicationReapplyEligibleAt?.toISOString() ?? null,
        startedAt: result.updatedUser.preApplicationReapplyStartedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error("Admin reset pre-application reapply error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.users.failedToResetReapply, {
      status: 500,
    })
  }
}
