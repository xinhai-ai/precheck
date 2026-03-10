import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { getSubmitBanRemainingSeconds } from "@/lib/pre-application/submit-ban-utils"
import { checkPreApplicationSubmitEligibility } from "@/lib/pre-application/submit-precheck"
import { getPreApplicationCaptchaSettings } from "@/lib/pre-application/captcha-settings"
import { getEnabledCaptchaRuntimeConfig } from "@/lib/captcha/config"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
  }

  if (!db) {
    return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
  }

  const userRecord = await db.user.findUnique({
    where: { id: user.id },
    select: { preApplicationSubmitBannedUntil: true },
  })
  const bannedUntil = userRecord?.preApplicationSubmitBannedUntil ?? null
  const remainingSeconds = getSubmitBanRemainingSeconds(bannedUntil)

  if (bannedUntil && remainingSeconds > 0) {
    return NextResponse.json({
      allowed: false,
      reason: "submit_banned",
      submitBannedUntil: bannedUntil.toISOString(),
      remainingSeconds,
      captchaEnabled: false,
      captchaProvider: null,
      captchaPublicConfig: null,
    })
  }

  const eligibility = await checkPreApplicationSubmitEligibility(`user:${user.id}`)
  const runtimeCaptcha = getEnabledCaptchaRuntimeConfig(await getPreApplicationCaptchaSettings())

  return NextResponse.json({
    allowed: eligibility.allowed,
    reason: eligibility.reason ?? null,
    submitQuotaStatus: eligibility.submitQuotaStatus,
    captchaEnabled: runtimeCaptcha.enabled,
    captchaProvider: runtimeCaptcha.provider,
    captchaPublicConfig: runtimeCaptcha.publicConfig,
  })
}
