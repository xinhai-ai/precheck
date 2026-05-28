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

export function buildOAuthState({ locale }: { locale?: string | null }) {
  const searchParams = new URLSearchParams()
  const normalizedLocale = normalizeOAuthLocale(locale)
  if (normalizedLocale) {
    searchParams.set("locale", normalizedLocale)
  }

  const state = searchParams.toString()
  return state || undefined
}

export function parseOAuthState(state?: string | null): {
  locale: Locale
} {
  const searchParams = new URLSearchParams(state ?? "")
  const locale = normalizeOAuthLocale(searchParams.get("locale")) ?? defaultLocale

  return { locale }
}
