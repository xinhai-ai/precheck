import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { userId: rawUserId } = await context.params
    const userId = rawUserId?.trim()

    if (!userId) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, { status: 400 })
    }

    const before = await db.shadowBannedUser.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        reason: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!before) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.shadowBan.notFound, {
        status: 404,
      })
    }

    const restored = await db.$transaction(async (tx) => {
      await tx.shadowBannedUser.delete({
        where: { userId },
      })

      const updated = await tx.preApplication.updateMany({
        where: {
          userId,
          status: "SHADOW_HIDDEN",
        },
        data: {
          status: "PENDING",
        },
      })

      return updated.count
    })

    await writeAuditLog(db, {
      action: "SHADOWBAN_REMOVE",
      entityType: "USER",
      entityId: userId,
      actor: user,
      before,
      metadata: {
        userId,
        restoredPreApplications: restored,
      },
      request,
    })

    return NextResponse.json({
      success: true,
      restoredPreApplications: restored,
    })
  } catch (error) {
    console.error("Shadow banned user delete error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.shadowBan.failedToDelete, {
      status: 500,
    })
  }
}
