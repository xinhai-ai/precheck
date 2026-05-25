import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  getDashboardOnlineSummary,
  recordDashboardOnlinePresence,
} from "@/lib/dashboard/online-presence"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (user.status !== "ACTIVE") {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    const recorded = await recordDashboardOnlinePresence({
      id: user.id,
      role: user.role,
    })

    if (!recorded) {
      return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 503 })
    }

    const summary = await getDashboardOnlineSummary()

    if (!summary) {
      return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 503 })
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Dashboard online summary API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 500 })
  }
}
