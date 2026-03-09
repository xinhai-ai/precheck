export interface TurnstileConfig {
  siteKey: string
  siteKeyConfigured: boolean
  secretKeyConfigured: boolean
  enabled: boolean
}

export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ""
  const siteKeyConfigured = Boolean(siteKey)
  const secretKeyConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())

  return {
    siteKey,
    siteKeyConfigured,
    secretKeyConfigured,
    enabled: siteKeyConfigured && secretKeyConfigured,
  }
}
