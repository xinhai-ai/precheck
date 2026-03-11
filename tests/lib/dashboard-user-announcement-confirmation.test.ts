import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const schemaSource = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const siteSettingsSource = readFileSync(
  new URL("../../lib/site-settings.ts", import.meta.url),
  "utf8",
)
const systemConfigRouteSource = readFileSync(
  new URL("../../app/api/admin/system-config/route.ts", import.meta.url),
  "utf8",
)
const settingsFormSource = readFileSync(
  new URL("../../components/admin/settings-form.tsx", import.meta.url),
  "utf8",
)
const dashboardLayoutSource = readFileSync(
  new URL("../../app/[locale]/dashboard/layout.tsx", import.meta.url),
  "utf8",
)
const dashboardLayoutClientSource = readFileSync(
  new URL("../../components/dashboard/dashboard-layout-client.tsx", import.meta.url),
  "utf8",
)
const zhDictSource = readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8")
const openApiSource = readFileSync(new URL("../../lib/openapi-spec.ts", import.meta.url), "utf8")

const gateComponentPath = new URL(
  "../../components/dashboard/new-user-announcement-gate.tsx",
  import.meta.url,
)
const retriggerRoutePath = new URL(
  "../../app/api/admin/system-config/dashboard-user-announcement/retrigger/route.ts",
  import.meta.url,
)

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

test("site settings schema includes dashboard announcement confirmation fields", () => {
  assert.match(schemaSource, /newUserAnnouncementEnabled\s+Boolean\s+@default\(false\)/)
  assert.match(schemaSource, /newUserAnnouncementContent\s+String\s+@default\(""\)/)
  assert.match(schemaSource, /newUserAnnouncementConfirmText\s+String\s+@default\(""\)/)
  assert.match(schemaSource, /newUserAnnouncementDelaySeconds\s+Int\s+@default\(0\)/)
  assert.match(schemaSource, /newUserAnnouncementVersion\s+Int\s+@default\(1\)/)
})

test("cached site settings supports dashboard announcement confirmation", () => {
  assert.match(siteSettingsSource, /newUserAnnouncementEnabled:\s*boolean/)
  assert.match(siteSettingsSource, /newUserAnnouncementContent:\s*string/)
  assert.match(siteSettingsSource, /newUserAnnouncementConfirmText:\s*string/)
  assert.match(siteSettingsSource, /newUserAnnouncementDelaySeconds:\s*number/)
  assert.match(siteSettingsSource, /newUserAnnouncementVersion:\s*number/)
  assert.match(siteSettingsSource, /newUserAnnouncementEnabled:\s*false/)
  assert.match(siteSettingsSource, /newUserAnnouncementContent:\s*""/)
  assert.match(siteSettingsSource, /newUserAnnouncementConfirmText:\s*""/)
  assert.match(siteSettingsSource, /newUserAnnouncementDelaySeconds:\s*0/)
  assert.match(siteSettingsSource, /newUserAnnouncementVersion:\s*1/)
})

test("admin system config validates and returns dashboard announcement confirmation fields", () => {
  assert.match(
    systemConfigRouteSource,
    /newUserAnnouncementEnabled:\s*z\.boolean\(\)\.optional\(\)/,
  )
  assert.match(systemConfigRouteSource, /newUserAnnouncementContent:\s*z\.string\(\)\.optional\(\)/)
  assert.match(
    systemConfigRouteSource,
    /newUserAnnouncementConfirmText:\s*z\.string\(\)\.optional\(\)/,
  )
  assert.match(
    systemConfigRouteSource,
    /newUserAnnouncementDelaySeconds:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(300\)\.optional\(\)/,
  )
  assert.match(
    systemConfigRouteSource,
    /newUserAnnouncementVersion:\s*settings\.newUserAnnouncementVersion\s*\?\?\s*1/,
  )
  assert.match(
    systemConfigRouteSource,
    /newUserAnnouncementEnabled:\s*updated\.newUserAnnouncementEnabled/,
  )
  assert.match(systemConfigRouteSource, /newUserAnnouncementVersion\"/)
})

test("announcement retrigger route exists", () => {
  assert.equal(existsSync(retriggerRoutePath), true)
  const retriggerSource = readIfExists(retriggerRoutePath)
  assert.match(retriggerSource, /newUserAnnouncementVersion:\s*\{\s*increment:\s*1\s*\}/)
  assert.match(retriggerSource, /invalidateSiteSettingsCache/)
})

test("admin settings form exposes dashboard announcement confirmation controls", () => {
  assert.match(settingsFormSource, /newUserAnnouncementEnabled:\s*boolean/)
  assert.match(settingsFormSource, /newUserAnnouncementContent:\s*string/)
  assert.match(settingsFormSource, /newUserAnnouncementConfirmText:\s*string/)
  assert.match(settingsFormSource, /newUserAnnouncementDelaySeconds:\s*number/)
  assert.match(settingsFormSource, /newUserAnnouncementVersion:\s*number/)
  assert.match(settingsFormSource, /t\.newUserAnnouncementEnabled/)
  assert.match(settingsFormSource, /t\.newUserAnnouncementContent/)
  assert.match(settingsFormSource, /t\.newUserAnnouncementConfirmText/)
  assert.match(settingsFormSource, /t\.newUserAnnouncementDelaySeconds/)
  assert.match(settingsFormSource, /t\.newUserAnnouncementRetrigger/)
})

test("announcement settings copy exists in both dictionaries", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"newUserAnnouncementEnabled"\s*:/)
    assert.match(source, /"newUserAnnouncementEnabledDesc"\s*:/)
    assert.match(source, /"newUserAnnouncementContent"\s*:/)
    assert.match(source, /"newUserAnnouncementConfirmText"\s*:/)
    assert.match(source, /"newUserAnnouncementDelaySeconds"\s*:/)
    assert.match(source, /"newUserAnnouncementVersion"\s*:/)
    assert.match(source, /"newUserAnnouncementRetrigger"\s*:/)
    assert.match(source, /"newUserAnnouncementRetriggerSuccess"\s*:/)
  }
})

test("dashboard layout passes announcement config into the client layout", () => {
  assert.match(dashboardLayoutSource, /announcement=\{\s*\{/)
  assert.match(dashboardLayoutSource, /enabled:\s*settings\.newUserAnnouncementEnabled/)
  assert.match(dashboardLayoutSource, /content:\s*settings\.newUserAnnouncementContent/)
  assert.match(dashboardLayoutSource, /confirmText:\s*settings\.newUserAnnouncementConfirmText/)
  assert.match(dashboardLayoutSource, /delaySeconds:\s*settings\.newUserAnnouncementDelaySeconds/)
  assert.match(dashboardLayoutSource, /version:\s*settings\.newUserAnnouncementVersion/)
})

test("dashboard layout client mounts the announcement gate", () => {
  assert.match(dashboardLayoutClientSource, /NewUserAnnouncementGate/)
  assert.match(dashboardLayoutClientSource, /announcement:/)
  assert.match(dashboardLayoutClientSource, /<NewUserAnnouncementGate/)
})

test("announcement gate enforces local confirmation behavior", () => {
  assert.equal(existsSync(gateComponentPath), true)
  const gateSource = readIfExists(gateComponentPath)
  assert.match(gateSource, /user-announcement-ack/)
  assert.match(gateSource, /user\.role\s*!==\s*"USER"/)
  assert.match(gateSource, /localStorage\.getItem/)
  assert.match(gateSource, /localStorage\.setItem/)
  assert.match(gateSource, /inputValue\s*===\s*announcement\.confirmText/)
  assert.match(gateSource, /countdown/)
  assert.match(gateSource, /onEscapeKeyDown/)
  assert.match(gateSource, /onInteractOutside/)
})

test("openapi documents announcement config and retrigger endpoint", () => {
  assert.match(openApiSource, /newUserAnnouncementEnabled:\s*\{\s*type:\s*"boolean"/)
  assert.match(openApiSource, /newUserAnnouncementContent:\s*\{\s*type:\s*"string"/)
  assert.match(openApiSource, /newUserAnnouncementConfirmText:\s*\{\s*type:\s*"string"/)
  assert.match(openApiSource, /newUserAnnouncementDelaySeconds:\s*\{\s*type:\s*"integer"/)
  assert.match(openApiSource, /newUserAnnouncementVersion:\s*\{\s*type:\s*"integer"/)
  assert.match(openApiSource, /"\/admin\/system-config\/dashboard-user-announcement\/retrigger"/)
})
