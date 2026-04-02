import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"

function normalizeOAuthLocale(locale?: string | null): Locale | null {
  if (!locale) {
    return null
  }

  const normalized = locale.trim().toLowerCase()
  if (locales.includes(normalized as Locale)) {
    return normalized as Locale
  }

  return null
}

export function buildOAuthState({
  fingerprintContextToken,
  locale,
}: {
  fingerprintContextToken?: string | null
  locale?: string | null
}) {
  const searchParams = new URLSearchParams()
  const normalizedLocale = normalizeOAuthLocale(locale)
  if (normalizedLocale) {
    searchParams.set("locale", normalizedLocale)
  }

  const trimmedFingerprintContextToken = fingerprintContextToken?.trim()
  if (trimmedFingerprintContextToken) {
    searchParams.set("fp_ctx", trimmedFingerprintContextToken)
  }

  const state = searchParams.toString()
  return state || undefined
}

export function parseOAuthState(state?: string | null): {
  fingerprintContextToken: string | null
  locale: Locale
} {
  if (state?.startsWith("fp:")) {
    return {
      fingerprintContextToken: state.slice(3).trim() || null,
      locale: defaultLocale,
    }
  }

  const searchParams = new URLSearchParams(state ?? "")
  const locale = normalizeOAuthLocale(searchParams.get("locale")) ?? defaultLocale

  return {
    fingerprintContextToken: searchParams.get("fp_ctx")?.trim() || null,
    locale,
  }
}
