export type CaptchaProvider = "turnstile" | "hcaptcha" | "geetest"

export interface CaptchaProviderConfig {
  provider: CaptchaProvider
  publicConfig: Record<string, string> | null
  siteKeyConfigured: boolean
  secretKeyConfigured: boolean
  enabled: boolean
}

export function getCaptchaProviderConfig(provider: CaptchaProvider): CaptchaProviderConfig {
  if (provider === "turnstile") {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim() || ""
    return {
      provider,
      publicConfig: siteKey ? { siteKey } : null,
      siteKeyConfigured: Boolean(siteKey),
      secretKeyConfigured: Boolean(secret),
      enabled: Boolean(siteKey) && Boolean(secret),
    }
  }

  if (provider === "hcaptcha") {
    const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim() || ""
    const secret = process.env.HCAPTCHA_SECRET_KEY?.trim() || ""
    return {
      provider,
      publicConfig: siteKey ? { siteKey } : null,
      siteKeyConfigured: Boolean(siteKey),
      secretKeyConfigured: Boolean(secret),
      enabled: Boolean(siteKey) && Boolean(secret),
    }
  }

  const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID?.trim() || ""
  const secret = process.env.GEETEST_CAPTCHA_KEY?.trim() || ""
  return {
    provider,
    publicConfig: captchaId ? { captchaId } : null,
    siteKeyConfigured: Boolean(captchaId),
    secretKeyConfigured: Boolean(secret),
    enabled: Boolean(captchaId) && Boolean(secret),
  }
}

export function getCaptchaProvidersHealth() {
  return {
    captchaTurnstile: { status: getCaptchaProviderConfig("turnstile").enabled ? "up" : "unconfigured" } as const,
    captchaHcaptcha: { status: getCaptchaProviderConfig("hcaptcha").enabled ? "up" : "unconfigured" } as const,
    captchaGeetest: { status: getCaptchaProviderConfig("geetest").enabled ? "up" : "unconfigured" } as const,
  }
}

export function getEnabledCaptchaRuntimeConfig(settings: {
  preApplicationCaptchaEnabled?: boolean | null
  preApplicationCaptchaProvider?: string | null
}) {
  if (!settings.preApplicationCaptchaEnabled || !settings.preApplicationCaptchaProvider) {
    return { enabled: false, provider: null, publicConfig: null }
  }

  const provider = settings.preApplicationCaptchaProvider as CaptchaProvider
  const config = getCaptchaProviderConfig(provider)
  if (!config.enabled) {
    return { enabled: false, provider, publicConfig: config.publicConfig }
  }

  return { enabled: true, provider, publicConfig: config.publicConfig }
}
