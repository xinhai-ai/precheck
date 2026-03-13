import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isAdmin, isSuperAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

const ignoredUserSchema = z.object({
  userId: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(500),
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

    const items = await db.riskIgnoredUser.findMany({
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
          },
        },
      },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error("Risk control ignored users list error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.failedToFetchIgnoredUsers, {
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
    const data = ignoredUserSchema.parse(body)

    const targetUser = await db.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, name: true, role: true, status: true },
    })

    if (!targetUser) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.userNotFound, {
        status: 404,
      })
    }

    const before = await db.riskIgnoredUser.findUnique({
      where: { userId: data.userId },
    })

    const saved = await db.riskIgnoredUser.upsert({
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
          },
        },
      },
    })

    await writeAuditLog(db, {
      action: "RISK_IGNORED_USER_UPSERT",
      entityType: "USER",
      entityId: targetUser.id,
      actor: user,
      before,
      after: saved,
      metadata: {
        reason: data.reason,
      },
      request,
    })

    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message || "Invalid payload" },
      })
    }

    console.error("Risk control ignored user upsert error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.riskControl.failedToSaveIgnoredUser, {
      status: 500,
    })
  }
}
