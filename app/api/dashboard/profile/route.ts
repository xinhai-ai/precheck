import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { getSiteSettings } from "@/lib/site-settings"
import { isAllowedAvatarUrl } from "@/lib/avatar-url"

const profileSchema = z.object({
  name: z.string().max(80, "Name is too long").optional(),
  avatar: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
})

export async function PUT(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request)
  if (!user) {
    return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
  }
  if (!db) {
    return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
  }

  try {
    const body = await request.json()
    const { name, avatar } = profileSchema.parse(body)
    const trimmedName = name?.trim()
    const trimmedAvatar = avatar?.trim()
    const settings = await getSiteSettings()

    if (trimmedAvatar && !isAllowedAvatarUrl(trimmedAvatar, settings.allowedAvatarDomains)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: "头像仅支持白名单 HTTPS 域名" },
      })
    }

    const before = await db.user.findUnique({ where: { id: user.id } })

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        ...(name !== undefined && { name: trimmedName || null }),
        ...(avatar !== undefined && { avatar: trimmedAvatar || null }),
      },
      select: {
        name: true,
        email: true,
        avatar: true,
      },
    })

    await writeAuditLog(db, {
      action: "USER_PROFILE_UPDATE",
      entityType: "USER",
      entityId: user.id,
      actor: user,
      before,
      after: updated,
      metadata: { payload: { name: trimmedName, avatar: trimmedAvatar } },
      request,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }
    console.error("Update profile API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.dashboard.profile.failedToUpdate, {
      status: 500,
    })
  }
}
