import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { ensureUserTicketsEnabled } from "@/lib/tickets/feature-guard"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    const disabledResponse = await ensureUserTicketsEnabled(request)
    if (disabledResponse) {
      return disabledResponse
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const ticket = await db.ticket.findUnique({
      where: { id, userId: user.id },
      include: {
        preApplication: {
          select: {
            id: true,
            status: true,
            registerEmail: true,
            essay: true,
            guidance: true,
            reviewedAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    })

    if (!ticket) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error("Get ticket error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 500 })
  }
}
