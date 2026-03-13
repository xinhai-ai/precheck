import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { shouldHidePreApplicationFromAdmin } from "@/lib/pre-application/admin-archived-visibility"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const { id } = await context.params

    const preApplication = await db.preApplication.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!preApplication || shouldHidePreApplicationFromAdmin(preApplication.status, user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    // 获取预申请的版本历史
    const versions = await db.preApplicationVersion.findMany({
      where: { preApplicationId: id },
      orderBy: { version: "desc" },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ records: versions })
  } catch (error) {
    console.error("Admin pre-application history error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.historyFetchFailed, {
      status: 500,
    })
  }
}
