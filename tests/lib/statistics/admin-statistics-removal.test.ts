import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"

const repoRoot = new URL("../../../", import.meta.url)

function workspaceUrl(relativePath: string) {
  return new URL(relativePath, repoRoot)
}

function readWorkspaceFile(relativePath: string) {
  return readFileSync(workspaceUrl(relativePath), "utf8")
}

test("admin statistics center pages and services are removed", () => {
  for (const relativePath of [
    "app/[locale]/admin/statistics/page.tsx",
    "app/[locale]/admin/statistics/accounts/[id]/page.tsx",
    "lib/statistics/admin-statistics.ts",
    "lib/statistics/traffic-attribution.ts",
    "tests/lib/statistics/admin-statistics-center.test.ts",
    "tests/lib/statistics/traffic-attribution.test.ts",
  ]) {
    assert.equal(existsSync(workspaceUrl(relativePath)), false, relativePath)
  }
})

test("admin navigation and users table no longer expose statistics center entries", () => {
  const sidebar = readWorkspaceFile("components/admin/sidebar.tsx")
  const usersTable = readWorkspaceFile("components/admin/users-table.tsx")

  assert.doesNotMatch(sidebar, /statisticsCenter/)
  assert.doesNotMatch(sidebar, /admin\/statistics/)
  assert.doesNotMatch(usersTable, /accountStatistics/)
  assert.doesNotMatch(usersTable, /admin\/statistics\/accounts/)
})

test("locale dictionaries no longer keep statistics center copy", () => {
  const zh = JSON.parse(readWorkspaceFile("dictionaries/zh.json"))
  const en = JSON.parse(readWorkspaceFile("dictionaries/en.json"))

  assert.equal("statisticsCenter" in zh.admin, false)
  assert.equal("statisticsCenterDesc" in zh.admin, false)
  assert.equal("accountStatistics" in zh.admin, false)
  assert.equal("statisticsCenter" in en.admin, false)
  assert.equal("statisticsCenterDesc" in en.admin, false)
  assert.equal("accountStatistics" in en.admin, false)
})
