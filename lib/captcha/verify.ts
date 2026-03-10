import type { CaptchaProvider } from "@/lib/captcha/config"
import { verifyTurnstileToken } from "@/lib/turnstile"
import { verifyHCaptchaPayload } from "@/lib/captcha/providers/hcaptcha"
import { verifyGeeTestPayload } from "@/lib/captcha/providers/geetest"

export type CaptchaVerifyInput = {
  provider: CaptchaProvider
  payload: Record<string, unknown>
  remoteIp?: string
}

export type CaptchaVerifyResult = {
  ok: boolean
  reason?: string
}

export async function verifyCaptchaChallenge(
  input: CaptchaVerifyInput,
): Promise<CaptchaVerifyResult> {
  if (input.provider === "turnstile") {
    const token = typeof input.payload.token === "string" ? input.payload.token.trim() : ""
    if (!token) {
      return { ok: false, reason: "missing_token" }
    }

    return {
      ok: await verifyTurnstileToken(token, input.remoteIp),
      reason: "turnstile_verification_failed",
    }
  }

  if (input.provider === "hcaptcha") {
    const ok = await verifyHCaptchaPayload(input.payload, input.remoteIp)
    return { ok, reason: ok ? undefined : "hcaptcha_verification_failed" }
  }

  const ok = await verifyGeeTestPayload(input.payload)
  return { ok, reason: ok ? undefined : "geetest_verification_failed" }
}
