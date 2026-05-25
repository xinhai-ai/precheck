import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const onlineRoutePath = new URL("../../app/api/dashboard/online/route.ts", import.meta.url)
const onlinePresencePath = new URL("../../lib/dashboard/online-presence.ts", import.meta.url)
const onlineRouteSource = existsSync(onlineRoutePath) ? readFileSync(onlineRoutePath, "utf8") : ""
const onlinePresenceSource = existsSync(onlinePresencePath)
  ? readFileSync(onlinePresencePath, "utf8")
  : ""
const dashboardLayoutClientSource = readFileSync(
  new URL("../../components/dashboard/dashboard-layout-client.tsx", import.meta.url),
  "utf8",
)
const dashboardHeaderSource = readFileSync(
  new URL("../../components/dashboard/header.tsx", import.meta.url),
  "utf8",
)
const dashboardPageSource = readFileSync(
  new URL("../../app/[locale]/dashboard/page.tsx", import.meta.url),
  "utf8",
)
const zhDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8"),
) as Record<string, any>
const enDictionary = JSON.parse(
  readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8"),
) as Record<string, any>

test("dashboard online summary api uses Redis heartbeat presence instead of session expiry", () => {
  assert.match(onlineRouteSource, /getCurrentUserFromRequest/)
  assert.match(onlineRouteSource, /ApiErrorKeys\.notAuthenticated/)
  assert.doesNotMatch(onlineRouteSource, /db\.session\.findMany/)
  assert.doesNotMatch(onlineRouteSource, /expires:\s*\{\s*gt:\s*now\s*\}/)
  assert.match(onlineRouteSource, /recordDashboardOnlinePresence/)
  assert.match(onlineRouteSource, /getDashboardOnlineSummary/)
  assert.match(onlinePresenceSource, /getRedisClient/)
  assert.match(onlinePresenceSource, /DASHBOARD_ONLINE_WINDOW_SECONDS/)
  assert.match(onlinePresenceSource, /\.zadd\(/)
  assert.match(onlinePresenceSource, /\.zremrangebyscore\(/)
  assert.match(onlinePresenceSource, /\.zrangebyscore\(/)
  assert.match(onlinePresenceSource, /\.hset\(/)
  assert.match(onlinePresenceSource, /role\s*===\s*"ADMIN"/)
  assert.match(onlinePresenceSource, /role\s*===\s*"SUPER_ADMIN"/)
})

test("dashboard layout fetches online summary for the header only", () => {
  assert.match(dashboardLayoutClientSource, /\/api\/dashboard\/online/)
  assert.match(dashboardLayoutClientSource, /useDashboardOnlineSummary/)
  assert.match(dashboardHeaderSource, /useDashboardOnlineSummary/)
  assert.doesNotMatch(dashboardPageSource, /useDashboardOnlineSummary/)
  assert.doesNotMatch(dashboardPageSource, /dict\.dashboard\.onlineStatus/)
})

test("online summary dictionaries include header and dashboard labels", () => {
  assert.equal(zhDictionary.dashboard.onlineStatus, "在线状态")
  assert.equal(zhDictionary.dashboard.onlineUsers, "在线总人数")
  assert.equal(zhDictionary.dashboard.onlineAdmins, "在线管理员")
  assert.equal(enDictionary.dashboard.onlineStatus, "Online status")
  assert.equal(enDictionary.dashboard.onlineUsers, "Online users")
  assert.equal(enDictionary.dashboard.onlineAdmins, "Online admins")
})
