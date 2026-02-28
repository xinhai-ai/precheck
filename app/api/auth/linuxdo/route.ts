import { NextRequest, NextResponse } from "next/server"
import { getLinuxDoAuthUrl } from "@/lib/auth/oauth"
import { features } from "@/lib/features"
import { getSiteSettings } from "@/lib/site-settings"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { buildRedirectUrl } from "@/lib/url"

export async function GET(request: NextRequest) {
  if (!features.oauth.linuxdo) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.linuxdoNotConfigured, {
      status: 404,
    })
  }

  const settings = await getSiteSettings()
  if (!settings.oauthLogin) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.disabled, { status: 403 })
  }

  // 绑定模式已临时禁用（安全修复）
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("mode")
  if (mode === "bind") {
    return NextResponse.redirect(buildRedirectUrl("/dashboard/contribute?error=bind_disabled", request.url))
  }

  const url = await getLinuxDoAuthUrl()
  if (!url) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.failedToGenerateUrl, {
      status: 500,
    })
  }

  return NextResponse.redirect(url)
}
