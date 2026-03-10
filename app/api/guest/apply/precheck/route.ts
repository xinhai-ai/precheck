import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getQQVerifyStatus, QQ_VERIFY_CONFIG } from "@/lib/qq-verify"
import { getPreApplicationCaptchaSettings } from "@/lib/pre-application/captcha-settings"
import { getEnabledCaptchaRuntimeConfig } from "@/lib/captcha/config"
import { checkPreApplicationSubmitEligibility } from "@/lib/pre-application/submit-precheck"

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(QQ_VERIFY_CONFIG.cookieName)?.value
  const { verified, qqNumber } = await getQQVerifyStatus(token)

  if (!verified || !qqNumber) {
    return NextResponse.json({ error: "QQ 验证未通过" }, { status: 401 })
  }

  const eligibility = await checkPreApplicationSubmitEligibility(`qq:${qqNumber}`)
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
