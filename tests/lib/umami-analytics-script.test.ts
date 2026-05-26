import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layoutSource = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8")
const siteSettingsSource = readFileSync(new URL("../../lib/site-settings.ts", import.meta.url), "utf8")
const settingsApiSource = readFileSync(
  new URL("../../app/api/admin/settings/route.ts", import.meta.url),
  "utf8",
)
const settingsFormSource = readFileSync(
  new URL("../../components/admin/settings-form.tsx", import.meta.url),
  "utf8",
)
const schemaSource = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const createAuthTablesSource = readFileSync(
  new URL("../../scripts/001-create-auth-tables.sql", import.meta.url),
  "utf8",
)
const zhDictionary = JSON.parse(readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8"))
const enDictionary = JSON.parse(readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8"))

test("locale layout includes the Umami analytics script", () => {
  assert.match(layoutSource, /id="umami-analytics"/)
  assert.match(layoutSource, /src="https:\/\/umami\.anglergap\.org\/script\.js"/)
  assert.match(layoutSource, /data-website-id="9c8968bf-63bd-4a3c-9fe1-cae957f1d22a"/)
  assert.match(layoutSource, /defer/)
})

test("Umami analytics follows its own switch", () => {
  const umamiBlock = layoutSource.slice(
    layoutSource.indexOf("{umamiAnalyticsEnabled &&"),
    layoutSource.indexOf("<WebsiteJsonLd"),
  )

  assert.match(layoutSource, /const \{ analyticsEnabled, umamiAnalyticsEnabled \} = await getSiteSettings\(\)/)
  assert.match(umamiBlock, /id="umami-analytics"/)
  assert.doesNotMatch(umamiBlock, /LA_COLLECT/)
})

test("51.la analytics keeps the existing analytics switch", () => {
  const laBlock = layoutSource.slice(
    layoutSource.indexOf("{analyticsEnabled &&"),
    layoutSource.indexOf("{umamiAnalyticsEnabled &&"),
  )

  assert.match(laBlock, /id="LA_COLLECT"/)
  assert.match(laBlock, /id="LA_PERF"/)
  assert.doesNotMatch(laBlock, /id="umami-analytics"/)
})

test("site settings expose an independent Umami switch", () => {
  assert.match(siteSettingsSource, /umamiAnalyticsEnabled: boolean/)
  assert.match(siteSettingsSource, /umamiAnalyticsEnabled: true/)
  assert.match(siteSettingsSource, /umamiAnalyticsEnabled: record\.umamiAnalyticsEnabled/)
  assert.match(siteSettingsSource, /umamiAnalyticsEnabled: updates\.umamiAnalyticsEnabled \?\? current\.umamiAnalyticsEnabled/)
  assert.match(settingsApiSource, /umamiAnalyticsEnabled: z\.boolean\(\)/)
  assert.match(settingsFormSource, /umamiAnalyticsEnabled: boolean/)
  assert.match(settingsFormSource, /checked=\{settings\.umamiAnalyticsEnabled\}/)
  assert.match(settingsFormSource, /setSettings\(\{ \.\.\.settings, umamiAnalyticsEnabled: v \}\)/)
})

test("schema and setup SQL persist the independent Umami switch", () => {
  assert.match(schemaSource, /umamiAnalyticsEnabled\s+Boolean\s+@default\(true\)/)
  assert.match(createAuthTablesSource, /"umamiAnalyticsEnabled"\s+BOOLEAN NOT NULL DEFAULT true/)
})

test("locale dictionaries name 51.la and Umami switches separately", () => {
  assert.equal(zhDictionary.admin.analyticsEnabled, "51.la 统计")
  assert.equal(zhDictionary.admin.umamiAnalyticsEnabled, "Umami 统计")
  assert.equal(enDictionary.admin.analyticsEnabled, "51.la Analytics")
  assert.equal(enDictionary.admin.umamiAnalyticsEnabled, "Umami Analytics")
})
