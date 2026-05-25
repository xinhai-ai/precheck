import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationAppealStatus } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { isShadowHiddenLockedForAdminMutation } from "@/lib/pre-application/shadowban"
import { canArchivePreApplication } from "@/lib/auth/policies/pre-application"

const batchArchiveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    const baseArchivePolicy = canArchivePreApplication(user, { pendingAppealCount: 0 })

    if (!baseArchivePolicy.allowed) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const { ids } = batchArchiveSchema.parse(body)

    const records = await db.preApplication.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    })

    const hasShadowLocked = records.some((record) =>
      isShadowHiddenLockedForAdminMutation(record.status),
    )

    if (hasShadowLocked) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.shadowbanLocked, {
        status: 409,
      })
    }

    const pendingAppealCount = await db.preApplicationAppeal.count({
      where: {
        preApplicationId: { in: ids },
        status: PreApplicationAppealStatus.PENDING,
      },
    })
    const archivePolicy = canArchivePreApplication(user, { pendingAppealCount })

    if (!archivePolicy.allowed) {
      return createApiErrorResponse(
        request,
        archivePolicy.reason === "PENDING_APPEAL_EXISTS"
          ? ApiErrorKeys.preApplication.appeal.pendingAppealExists
          : ApiErrorKeys.general.forbidden,
        { status: archivePolicy.reason === "PENDING_APPEAL_EXISTS" ? 409 : 403 },
      )
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.preApplication.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED" },
      })

      for (const record of records) {
        await writeAuditLog(tx, {
          action: "PRE_APPLICATION_ARCHIVE",
          entityType: "PRE_APPLICATION",
          entityId: record.id,
          actor: user,
          before: { status: record.status },
          after: { status: "ARCHIVED" },
          request,
        })
      }

      return updated
    })

    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }
    console.error("Batch archive error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 500 })
  }
}
