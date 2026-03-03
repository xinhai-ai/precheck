import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
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

    const { userId: rawUserId } = await context.params
    const userId = rawUserId?.trim()

    if (!userId) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, { status: 400 })
    }

    const before = await db.riskIgnoredUser.findUnique({
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
      return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.ignoredUserNotFound, {
        status: 404,
      })
    }

    await db.riskIgnoredUser.delete({
      where: { userId },
    })

    await writeAuditLog(db, {
      action: "RISK_IGNORED_USER_REMOVE",
      entityType: "USER",
      entityId: userId,
      actor: user,
      before,
      metadata: { userId },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Risk control ignored user delete error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.riskControl.failedToDeleteIgnoredUser,
      { status: 500 },
    )
  }
}
