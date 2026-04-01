import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const configSource = readFileSync(new URL("../../lib/i18n/config.ts", import.meta.url), "utf8")
const middlewareSource = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8")
const getDictionarySource = readFileSync(
  new URL("../../lib/i18n/get-dictionary.ts", import.meta.url),
  "utf8",
)
const appNotFoundSource = readFileSync(new URL("../../app/not-found.tsx", import.meta.url), "utf8")
const localeNotFoundSource = readFileSync(
  new URL("../../app/[locale]/not-found.tsx", import.meta.url),
  "utf8",
)
const publicLayoutSource = readFileSync(
  new URL("../../app/[locale]/(public)/layout.tsx", import.meta.url),
  "utf8",
)
const atomRouteSource = readFileSync(
  new URL("../../app/[locale]/atom.xml/route.ts", import.meta.url),
  "utf8",
)
const feedRouteSource = readFileSync(
  new URL("../../app/[locale]/feed.xml/route.ts", import.meta.url),
  "utf8",
)
const dashboardMessagesPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/messages/page.tsx", import.meta.url),
  "utf8",
)
const dashboardPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/page.tsx", import.meta.url),
  "utf8",
)

test("default locale is zh and middleware redirects bare routes through shared config", () => {
  assert.match(configSource, /export const defaultLocale: Locale = "zh"/)
  assert.match(
    middlewareSource,
    /request\.nextUrl\.pathname = `\/\$\{defaultLocale\}\$\{pathname\}`/,
  )
})

test("dictionary and not-found fallbacks use the shared zh default locale", () => {
  assert.match(
    getDictionarySource,
    /dictionaries\[locale\]\?\.\(\) \?\? dictionaries\[defaultLocale\]\(\)/,
  )
  assert.match(appNotFoundSource, /getDictionary\(defaultLocale\)/)
  assert.match(appNotFoundSource, /locale=\{defaultLocale\}/)
  assert.match(localeNotFoundSource, /getDictionary\(defaultLocale\)/)
  assert.match(localeNotFoundSource, /locale=\{defaultLocale\}/)
})

test("public and feed route locale fallbacks use defaultLocale instead of hard-coded en", () => {
  assert.match(
    publicLayoutSource,
    /import \{ defaultLocale, locales, type Locale \} from "@\/lib\/i18n\/config"/,
  )
  assert.match(
    publicLayoutSource,
    /const currentLocale = locales\.includes\(locale as Locale\) \? \(locale as Locale\) : defaultLocale/,
  )
  assert.match(
    atomRouteSource,
    /const currentLocale = locales\.includes\(locale as Locale\) \? \(locale as Locale\) : defaultLocale/,
  )
  assert.match(
    feedRouteSource,
    /const currentLocale = locales\.includes\(locale as Locale\) \? \(locale as Locale\) : defaultLocale/,
  )
})

test("dashboard client pages initialize locale from shared zh default", () => {
  assert.match(dashboardMessagesPageSource, /useState<Locale>\(defaultLocale\)/)
  assert.match(dashboardPageSource, /useState<Locale>\(defaultLocale\)/)
})
