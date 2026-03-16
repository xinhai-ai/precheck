import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { writeAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const latest = await db.preApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        formalApplicationApprovedFeedbackAt: true,
      },
    })

    if (!latest) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.noPreApplicationFound, {
        status: 404,
      })
    }

    if (latest.formalApplicationApprovedFeedbackAt) {
      return NextResponse.json({
        ok: true,
        formalApplicationApprovedFeedbackAt:
          latest.formalApplicationApprovedFeedbackAt.toISOString(),
      })
    }

    if (latest.status !== PreApplicationStatus.APPROVED) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.formalApprovalFeedback.notAllowed,
        { status: 409 },
      )
    }

    const now = new Date()
    const updatedCount = await db.preApplication.updateMany({
      where: {
        id: latest.id,
        status: PreApplicationStatus.APPROVED,
        formalApplicationApprovedFeedbackAt: null,
      },
      data: {
        formalApplicationApprovedFeedbackAt: now,
      },
    })

    const current = await db.preApplication.findUnique({
      where: { id: latest.id },
      select: {
        id: true,
        formalApplicationApprovedFeedbackAt: true,
      },
    })

    const finalFeedbackAt = current?.formalApplicationApprovedFeedbackAt

    if (!finalFeedbackAt) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.formalApprovalFeedback.notAllowed,
        { status: 409 },
      )
    }

    if (updatedCount.count > 0) {
      await writeAuditLog(db, {
        action: "PRE_APPLICATION_FORMAL_APPROVAL_FEEDBACK",
        entityType: "PRE_APPLICATION",
        entityId: latest.id,
        actor: user,
        before: {
          formalApplicationApprovedFeedbackAt: latest.formalApplicationApprovedFeedbackAt,
        },
        after: {
          formalApplicationApprovedFeedbackAt: finalFeedbackAt,
        },
        request,
      })
    }

    return NextResponse.json({
      ok: true,
      formalApplicationApprovedFeedbackAt: finalFeedbackAt.toISOString(),
    })
  } catch (error) {
    console.error("Formal application approval feedback error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.preApplication.formalApprovalFeedback.failedToSubmit,
      { status: 500 },
    )
  }
}
