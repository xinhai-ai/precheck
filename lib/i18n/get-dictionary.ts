import { defaultLocale, type Locale } from "./config"

const dictionaries = {
  en: () => import("@/dictionaries/en.json").then((module) => module.default),
  zh: () => import("@/dictionaries/zh.json").then((module) => module.default),
}

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]?.() ?? dictionaries[defaultLocale]()
}

type DictionaryBase = Awaited<ReturnType<typeof getDictionary>>

type AdditionalDictionaryEntries = {
  auth: {
    register: {
      emailSuffixLabel?: string
      emailSuffixPlaceholder?: string
    }
  }
  preApplication: {
    emailSuffixLabel?: string
    emailSuffixPlaceholder?: string
  }
}

export type Dictionary = DictionaryBase & AdditionalDictionaryEntries
