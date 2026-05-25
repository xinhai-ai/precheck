import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function POST(request: NextRequest) {
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

  try {
    const deleted = await db.session.deleteMany({
      where: {
        user: {
          role: "USER",
        },
      },
    })

    await writeAuditLog(db, {
      action: "SYSTEM_CLEAR_USER_SESSIONS",
      entityType: "SYSTEM",
      entityId: "user-sessions",
      actor: user,
      metadata: {
        deletedCount: deleted.count,
        targetRole: "USER",
      },
      request,
    })

    return NextResponse.json({ success: true, deletedCount: deleted.count })
  } catch (error) {
    console.error("Failed to clear user sessions:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.clearUserSessions.failed, {
      status: 500,
    })
  }
}
