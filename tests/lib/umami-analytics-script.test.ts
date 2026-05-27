import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const layoutSource = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8")
function readOptionalSource(relativePath: string) {
  const url = new URL(`../../${relativePath}`, import.meta.url)
  return existsSync(url) ? readFileSync(url, "utf8") : ""
}

const analyticsBridgeSource = readOptionalSource("components/analytics/umami-analytics-bridge.tsx")
const analyticsClientSource = readOptionalSource("lib/analytics/umami-client.ts")
const analyticsIdentitySource = readOptionalSource("lib/analytics/umami-identity.ts")
const headerSource = readFileSync(
  new URL("../../components/layout/header.tsx", import.meta.url),
  "utf8",
)
const loginFormSource = readFileSync(
  new URL("../../components/auth/login-form.tsx", import.meta.url),
  "utf8",
)
const registerFormSource = readFileSync(
  new URL("../../components/auth/register-form.tsx", import.meta.url),
  "utf8",
)
const guestApplyFormSource = readFileSync(
  new URL("../../components/guest/guest-apply-form.tsx", import.meta.url),
  "utf8",
)
const dashboardPreApplicationFormSource = readFileSync(
  new URL("../../components/dashboard/pre-application-form.tsx", import.meta.url),
  "utf8",
)
const siteSettingsSource = readFileSync(
  new URL("../../lib/site-settings.ts", import.meta.url),
  "utf8",
)
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
const zhDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8"),
)
const enDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8"),
)

test("locale layout includes the Umami analytics script", () => {
  assert.match(layoutSource, /id="umami-analytics"/)
  assert.match(layoutSource, /src="https:\/\/umami\.anglergap\.org\/script\.js"/)
  assert.match(layoutSource, /data-website-id="9c8968bf-63bd-4a3c-9fe1-cae957f1d22a"/)
  assert.match(layoutSource, /defer/)
  assert.match(layoutSource, /data-performance="true"/)
  assert.match(layoutSource, /data-do-not-track="true"/)
  assert.match(layoutSource, /data-exclude-search="true"/)
  assert.match(layoutSource, /data-exclude-hash="true"/)
})

test("Umami analytics follows its own switch", () => {
  const umamiBlock = layoutSource.slice(
    layoutSource.indexOf("{umamiAnalyticsEnabled &&"),
    layoutSource.indexOf("<WebsiteJsonLd"),
  )

  assert.match(
    layoutSource,
    /const \{ analyticsEnabled, umamiAnalyticsEnabled \} = await getSiteSettings\(\)/,
  )
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
  assert.match(
    siteSettingsSource,
    /umamiAnalyticsEnabled: updates\.umamiAnalyticsEnabled \?\? current\.umamiAnalyticsEnabled/,
  )
  assert.match(settingsApiSource, /umamiAnalyticsEnabled: z\.boolean\(\)/)
  assert.match(settingsFormSource, /umamiAnalyticsEnabled: boolean/)
  assert.match(settingsFormSource, /checked=\{settings\.umamiAnalyticsEnabled\}/)
  assert.match(settingsFormSource, /setSettings\(\{ \.\.\.settings, umamiAnalyticsEnabled: v \}\)/)
})

test("layout provides anonymized identity data to the Umami bridge", () => {
  assert.match(layoutSource, /getCurrentUser\(\)/)
  assert.match(layoutSource, /createUmamiVisitorId/)
  assert.match(layoutSource, /<UmamiAnalyticsBridge/)
  assert.match(layoutSource, /visitorId=\{umamiVisitorId\}/)
  assert.match(layoutSource, /authState=\{user \? "member" : "guest"\}/)
  assert.match(analyticsIdentitySource, /createHmac\("sha256"/)
  assert.match(analyticsIdentitySource, /createUmamiVisitorId/)
  assert.match(analyticsIdentitySource, /getUmamiAccountAgeBucket/)
  assert.doesNotMatch(layoutSource, /email:/)
})

test("Umami bridge identifies visitors and tracks dashboard entry", () => {
  assert.match(analyticsBridgeSource, /identifyUmamiVisitor/)
  assert.match(analyticsBridgeSource, /getOrCreateUmamiGuestId/)
  assert.match(analyticsBridgeSource, /dashboard_enter/)
  assert.match(analyticsBridgeSource, /sessionStorage/)
  assert.match(analyticsClientSource, /trackUmamiEvent/)
  assert.match(analyticsClientSource, /identifyUmamiVisitor/)
  assert.match(analyticsClientSource, /identify\?: \(uniqueId: string/)
  assert.match(analyticsClientSource, /window\.umami\?\.identify\?\.\(visitorId/)
  assert.match(analyticsClientSource, /localStorage/)
  assert.match(analyticsClientSource, /umami_guest_id/)
})

test("auth and pre-application flows emit basic Umami events", () => {
  assert.match(loginFormSource, /auth_login_start/)
  assert.match(loginFormSource, /auth_login_success/)
  assert.match(loginFormSource, /auth_login_failed/)
  assert.match(loginFormSource, /auth_oauth_start/)
  assert.match(registerFormSource, /auth_register_start/)
  assert.match(registerFormSource, /auth_register_success/)
  assert.match(registerFormSource, /auth_register_failed/)
  assert.match(registerFormSource, /auth_oauth_start/)
  assert.match(guestApplyFormSource, /pre_application_submit_start/)
  assert.match(guestApplyFormSource, /pre_application_submit_success/)
  assert.match(guestApplyFormSource, /pre_application_submit_failed/)
})

test("homepage announcements and dashboard pre-application actions emit Umami events", () => {
  assert.match(headerSource, /trackUmamiEvent/)
  assert.match(headerSource, /homepage_video_announcement_click/)
  assert.match(headerSource, /homepage_qa_group_click/)
  assert.match(dashboardPreApplicationFormSource, /trackUmamiEvent/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_draft_save_start/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_draft_save_success/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_draft_save_failed/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_review_submit_click/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_review_submit_start/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_review_submit_success/)
  assert.match(dashboardPreApplicationFormSource, /pre_application_review_submit_failed/)
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
