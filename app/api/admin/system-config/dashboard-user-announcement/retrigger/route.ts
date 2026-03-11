import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { getSiteSettings, invalidateSiteSettingsCache } from "@/lib/site-settings"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user || !isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    await getSiteSettings()

    const before = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: { newUserAnnouncementVersion: true },
    })

    const updated = await db.siteSettings.update({
      where: { id: "global" },
      data: {
        newUserAnnouncementVersion: { increment: 1 },
      },
      select: { newUserAnnouncementVersion: true },
    })

    await writeAuditLog(db, {
      action: "SYSTEM_CONFIG_UPDATE",
      entityType: "SITE_SETTINGS",
      entityId: "global",
      actor: user,
      before,
      after: updated,
      metadata: {
        fields: ["newUserAnnouncementVersion"],
        reason: "dashboard-user-announcement-retrigger",
      },
      request,
    })

    await invalidateSiteSettingsCache()

    return NextResponse.json({ newUserAnnouncementVersion: updated.newUserAnnouncementVersion })
  } catch (error) {
    console.error("Dashboard user announcement retrigger error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.systemConfig.failedToUpdate, {
      status: 500,
    })
  }
}
