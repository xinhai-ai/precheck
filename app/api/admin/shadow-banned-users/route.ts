import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin, isSuperAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  SHADOW_HIDE_SOURCE_STATUSES,
  SHADOW_HIDDEN_STATUS,
} from "@/lib/pre-application/shadowban"

const shadowBanSchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const items = await db.shadowBannedUser.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        reason: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Shadow banned users list error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.shadowBan.failedToFetch, {
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const data = shadowBanSchema.parse(body)

    const targetUser = await db.user.findUnique({
      where: { id: data.userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    })

    if (!targetUser) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.shadowBan.userNotFound, {
        status: 404,
      })
    }

    const before = await db.shadowBannedUser.findUnique({
      where: { userId: data.userId },
      select: {
        id: true,
        userId: true,
        reason: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const { saved, affected } = await db.$transaction(async (tx) => {
      const entry = await tx.shadowBannedUser.upsert({
        where: { userId: data.userId },
        create: {
          userId: data.userId,
          reason: data.reason,
          createdById: user.id,
        },
        update: {
          reason: data.reason,
          createdById: user.id,
        },
        select: {
          id: true,
          userId: true,
          reason: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      })

      const updated = await tx.preApplication.updateMany({
        where: {
          userId: data.userId,
          status: {
            in: [...SHADOW_HIDE_SOURCE_STATUSES],
          },
        },
        data: {
          status: SHADOW_HIDDEN_STATUS,
        },
      })

      return { saved: entry, affected: updated.count }
    })

    await writeAuditLog(db, {
      action: "SHADOWBAN_UPSERT",
      entityType: "USER",
      entityId: data.userId,
      actor: user,
      before,
      after: saved,
      metadata: {
        reason: data.reason,
        shadowedPreApplications: affected,
      },
      request,
    })

    return NextResponse.json({ ...saved, shadowedPreApplications: affected })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message || "Invalid payload" },
      })
    }

    console.error("Shadow banned user upsert error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.shadowBan.failedToSave, {
      status: 500,
    })
  }
}
