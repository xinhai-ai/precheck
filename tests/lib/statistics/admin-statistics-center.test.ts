import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const repoRoot = new URL("../../../", import.meta.url)

function readWorkspaceFile(relativePath: string) {
  return readFileSync(new URL(relativePath, repoRoot), "utf8")
}

test("admin statistics center routes and service are wired", () => {
  const overviewPagePath = new URL("app/[locale]/admin/statistics/page.tsx", repoRoot)
  const accountPagePath = new URL("app/[locale]/admin/statistics/accounts/[id]/page.tsx", repoRoot)

  assert.equal(existsSync(overviewPagePath), true)
  assert.equal(existsSync(accountPagePath), true)

  const overviewPage = readWorkspaceFile("app/[locale]/admin/statistics/page.tsx")
  const accountPage = readWorkspaceFile("app/[locale]/admin/statistics/accounts/[id]/page.tsx")

  assert.match(overviewPage, /getAdminStatisticsOverview/)
  assert.match(overviewPage, /sourceAttribution/)
  assert.match(overviewPage, /retention/)
  assert.match(overviewPage, /systemHealth/)
  assert.match(accountPage, /getAdminAccountStatistics/)
  assert.match(accountPage, /AccountStatisticsPage/)
})

test("statistics center uses one unified chart instead of many distribution cards", () => {
  const overviewPage = readWorkspaceFile("app/[locale]/admin/statistics/page.tsx")

  assert.match(overviewPage, /UnifiedStatisticsChart/)
  assert.match(overviewPage, /chartRows/)
  assert.doesNotMatch(overviewPage, /<DistributionList/)
  assert.doesNotMatch(overviewPage, /指标字典/)
  assert.doesNotMatch(overviewPage, /metricDefinitions/)
})

test("admin users table links each user row to account statistics", () => {
  const usersTable = readWorkspaceFile("components/admin/users-table.tsx")

  assert.match(usersTable, /admin\/statistics\/accounts/)
  assert.match(usersTable, /accountStatistics/)
})

test("statistics overview service omits the metric dictionary payload", () => {
  const statisticsService = readWorkspaceFile("lib/statistics/admin-statistics.ts")

  assert.doesNotMatch(statisticsService, /metricDefinitions/)
  assert.doesNotMatch(statisticsService, /MetricDefinition/)
})

test("admin sidebar exposes statistics center for admins", () => {
  const sidebar = readWorkspaceFile("components/admin/sidebar.tsx")

  assert.match(sidebar, /BarChart3/)
  assert.match(sidebar, /admin\/statistics/)
  assert.match(sidebar, /statisticsCenter/)
  assert.match(sidebar, /superAdminOnly:\s*false/)
})

test("statistics copy exists in both locale dictionaries", () => {
  const zh = JSON.parse(readWorkspaceFile("dictionaries/zh.json"))
  const en = JSON.parse(readWorkspaceFile("dictionaries/en.json"))

  assert.equal(zh.admin.statisticsCenter, "统计中心")
  assert.equal(en.admin.statisticsCenter, "Statistics Center")
  assert.equal(typeof zh.admin.statisticsCenterDesc, "string")
  assert.equal(typeof en.admin.statisticsCenterDesc, "string")
})
