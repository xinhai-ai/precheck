import { NextRequest, NextResponse } from "next/server"
import { getGitHubAuthUrl } from "@/lib/auth/oauth"
import { features } from "@/lib/features"
import { getSiteSettings } from "@/lib/site-settings"
import { createApiErrorResponse, resolveLocaleForRequest } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { buildOAuthState } from "@/lib/auth/oauth-state"

export async function GET(request: NextRequest) {
  if (!features.oauth.github) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.githubNotConfigured, {
      status: 404,
    })
  }

  const settings = await getSiteSettings()
  if (!settings.oauthLogin) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.disabled, { status: 403 })
  }

  const locale = resolveLocaleForRequest(request)
  const state = buildOAuthState({ locale })
  const url = await getGitHubAuthUrl(state)
  if (!url) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.oauth.failedToGenerateUrl, {
      status: 500,
    })
  }

  return NextResponse.redirect(url)
}
