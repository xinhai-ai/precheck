import { type NextRequest, NextResponse } from "next/server"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { getSiteSettings } from "@/lib/site-settings"

export async function getUserTicketsEnabled(): Promise<boolean> {
  const settings = await getSiteSettings()
  return settings.userTicketsEnabled
}

export async function ensureUserTicketsEnabled(
  request: NextRequest,
): Promise<NextResponse | null> {
  const enabled = await getUserTicketsEnabled()
  if (enabled) {
    return null
  }

  return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
}
