import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const prismaSchema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8")
const siteSettingsSource = readFileSync(new URL("../../lib/site-settings.ts", import.meta.url), "utf8")
const adminSettingsRouteSource = readFileSync(
  new URL("../../app/api/admin/settings/route.ts", import.meta.url),
  "utf8",
)
const adminSettingsFormSource = readFileSync(
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
const dashboardPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/page.tsx", import.meta.url),
  "utf8",
)
const dashboardHeaderSource = readFileSync(
  new URL("../../components/dashboard/header.tsx", import.meta.url),
  "utf8",
)
const dashboardSidebarSource = readFileSync(
  new URL("../../components/dashboard/sidebar.tsx", import.meta.url),
  "utf8",
)
const dashboardCommandMenuSource = readFileSync(
  new URL("../../components/dashboard/dashboard-command-menu.tsx", import.meta.url),
  "utf8",
)
const ticketPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/tickets/page.tsx", import.meta.url),
  "utf8",
)
const ticketDetailPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/tickets/[id]/page.tsx", import.meta.url),
  "utf8",
)
const ticketApiSource = readFileSync(new URL("../../app/api/tickets/route.ts", import.meta.url), "utf8")
const ticketDetailApiSource = readFileSync(
  new URL("../../app/api/tickets/[id]/route.ts", import.meta.url),
  "utf8",
)
const ticketMessagesApiSource = readFileSync(
  new URL("../../app/api/tickets/[id]/messages/route.ts", import.meta.url),
  "utf8",
)

const zhDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8"),
) as Record<string, any>
const enDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8"),
) as Record<string, any>

test("user ticket visibility setting is wired through schema and admin settings", () => {
  assert.match(prismaSchema, /userTicketsEnabled\s+Boolean\s+@default\(true\)/)
  assert.match(siteSettingsSource, /userTicketsEnabled:\s*boolean/)
  assert.match(siteSettingsSource, /userTicketsEnabled:\s*true/)
  assert.match(adminSettingsRouteSource, /userTicketsEnabled:\s*z\.boolean\(\)/)
  assert.match(adminSettingsFormSource, /userTicketsEnabled:\s*boolean/)
})

test("dashboard ticket navigation receives the user ticket visibility flag", () => {
  assert.match(dashboardLayoutSource, /userTicketsEnabled/)
  assert.match(dashboardLayoutClientSource, /userTicketsEnabled/)
  assert.match(dashboardPageSource, /userTicketsEnabled/)
  assert.match(dashboardHeaderSource, /userTicketsEnabled/)
  assert.match(dashboardSidebarSource, /userTicketsEnabled/)
  assert.match(dashboardCommandMenuSource, /userTicketsEnabled/)
})

test("user ticket pages and apis guard against disabled user tickets", () => {
  assert.match(ticketPageSource, /userTicketsEnabled|ensureUserTicketsEnabled|getSiteSettings/)
  assert.match(ticketDetailPageSource, /userTicketsEnabled|ensureUserTicketsEnabled|getSiteSettings/)
  assert.match(ticketApiSource, /ensureUserTicketsEnabled/)
  assert.match(ticketDetailApiSource, /ensureUserTicketsEnabled/)
  assert.match(ticketMessagesApiSource, /ensureUserTicketsEnabled/)
})

test("admin settings dictionaries include user ticket visibility copy", () => {
  assert.equal(zhDictionary.admin.userTicketsEnabled, "启用用户侧工单")
  assert.equal(
    zhDictionary.admin.userTicketsEnabledDesc,
    "关闭后将隐藏并禁用用户侧工单功能，管理员后台工单管理不受影响",
  )
  assert.equal(enDictionary.admin.userTicketsEnabled, "Enable User Tickets")
  assert.equal(
    enDictionary.admin.userTicketsEnabledDesc,
    "Hide and disable tickets for end users when turned off; admin ticket management remains available.",
  )
})
