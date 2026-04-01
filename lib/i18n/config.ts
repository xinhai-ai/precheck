export const locales = ["en", "zh"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "zh"

export const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
}

export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  zh: "🇨🇳",
}

export const i18n = {
  locales,
  defaultLocale,
} as const

export type I18nConfig = typeof i18n
