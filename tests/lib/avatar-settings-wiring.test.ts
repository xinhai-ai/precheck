import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const prismaSchema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const siteSettingsSource = readFileSync(new URL("../../lib/site-settings.ts", import.meta.url), "utf8")
const systemConfigRouteSource = readFileSync(
  new URL("../../app/api/admin/system-config/route.ts", import.meta.url),
  "utf8",
)
const adminSettingsFormSource = readFileSync(
  new URL("../../components/admin/settings-form.tsx", import.meta.url),
  "utf8",
)
const profileRouteSource = readFileSync(
  new URL("../../app/api/dashboard/profile/route.ts", import.meta.url),
  "utf8",
)
const dashboardSettingsPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/settings/page.tsx", import.meta.url),
  "utf8",
)
const dashboardSettingsFormSource = readFileSync(
  new URL("../../components/dashboard/settings-form.tsx", import.meta.url),
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
const adminLayoutSource = readFileSync(
  new URL("../../app/[locale]/admin/layout.tsx", import.meta.url),
  "utf8",
)
const adminLayoutClientSource = readFileSync(
  new URL("../../components/admin/admin-layout-client.tsx", import.meta.url),
  "utf8",
)
const avatarComponentSource = readFileSync(
  new URL("../../components/ui/avatar.tsx", import.meta.url),
  "utf8",
)

test("avatar domain allowlist is wired through schema, cache, api, and admin ui", () => {
  assert.match(prismaSchema, /allowedAvatarDomains\s+Json\s+@default\("\[\]"\)/)
  assert.match(siteSettingsSource, /allowedAvatarDomains:\s*string\[\]/)
  assert.match(systemConfigRouteSource, /allowedAvatarDomains:\s*z\.array/)
  assert.match(adminSettingsFormSource, /systemConfigAvatarDomains/)

  const generalTabIndex = adminSettingsFormSource.indexOf('{activeTab === "general" && (')
  const securityTabIndex = adminSettingsFormSource.indexOf('{activeTab === "security" && (')
  const avatarDomainsIndex = adminSettingsFormSource.indexOf("systemConfigAvatarDomains")

  assert.notEqual(generalTabIndex, -1)
  assert.notEqual(securityTabIndex, -1)
  assert.notEqual(avatarDomainsIndex, -1)
  assert.ok(avatarDomainsIndex > generalTabIndex && avatarDomainsIndex < securityTabIndex)
})

test("profile update route validates avatar url against the allowlist", () => {
  assert.match(profileRouteSource, /getSiteSettings\(\)/)
  assert.match(profileRouteSource, /isAllowedAvatarUrl|getSafeAvatarUrl/)
  assert.match(profileRouteSource, /头像仅支持白名单 HTTPS 域名|allowlisted HTTPS avatar domains/)
  assert.match(dashboardSettingsFormSource, /avatarHint/)
})

test("dashboard settings page passes avatar allowlist to the profile form and shows it to users", () => {
  assert.match(dashboardSettingsPageSource, /getSiteSettings\(\)/)
  assert.match(dashboardSettingsPageSource, /allowedAvatarDomains=\{settings\.allowedAvatarDomains\}/)
  assert.match(dashboardSettingsFormSource, /allowedAvatarDomains:\s*string\[\]/)
  assert.match(dashboardSettingsFormSource, /allowedAvatarDomains\.length > 0|allowedAvatarDomains\.map\(/)
})

test("dashboard and admin layouts pass avatar allowlist into client providers", () => {
  assert.match(dashboardLayoutSource, /allowedAvatarDomains/)
  assert.match(dashboardLayoutClientSource, /AvatarAllowlistProvider/)
  assert.match(adminLayoutSource, /getSiteSettings\(\)/)
  assert.match(adminLayoutClientSource, /AvatarAllowlistProvider/)
})

test("AvatarImage resolves src through the avatar allowlist helper", () => {
  assert.match(avatarComponentSource, /useAvatarAllowlist|AvatarAllowlistContext/)
  assert.match(avatarComponentSource, /getSafeAvatarUrl/)
  assert.doesNotMatch(avatarComponentSource, /function AvatarImage[\s\S]*src=\{src\}/)
})
