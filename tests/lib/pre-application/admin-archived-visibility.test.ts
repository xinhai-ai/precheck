import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

const helperUrl = new URL(
  "../../../lib/pre-application/admin-archived-visibility.ts",
  import.meta.url,
)
const listRouteUrl = new URL("../../../app/api/admin/pre-applications/route.ts", import.meta.url)
const exportRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/export/route.ts",
  import.meta.url,
)
const historyRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/history/route.ts",
  import.meta.url,
)
const fingerprintRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/fingerprint/route.ts",
  import.meta.url,
)
const duplicateCheckRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/duplicate-check/route.ts",
  import.meta.url,
)
const reviewRequestRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/review-request/route.ts",
  import.meta.url,
)
const notesRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/notes/route.ts",
  import.meta.url,
)
const noteDetailRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/notes/[noteId]/route.ts",
  import.meta.url,
)
const tableUrl = new URL("../../../components/admin/pre-applications-table.tsx", import.meta.url)

const helperSource = readIfExists(helperUrl)
const listRouteSource = readIfExists(listRouteUrl)
const exportRouteSource = readIfExists(exportRouteUrl)
const historyRouteSource = readIfExists(historyRouteUrl)
const fingerprintRouteSource = readIfExists(fingerprintRouteUrl)
const duplicateCheckRouteSource = readIfExists(duplicateCheckRouteUrl)
const reviewRequestRouteSource = readIfExists(reviewRequestRouteUrl)
const notesRouteSource = readIfExists(notesRouteUrl)
const noteDetailRouteSource = readIfExists(noteDetailRouteUrl)
const tableSource = readIfExists(tableUrl)

test("archived visibility helper exists and defines super-admin-only access", () => {
  assert.equal(existsSync(helperUrl), true)
  assert.match(helperSource, /export function canViewArchivedPreApplications/)
  assert.match(helperSource, /export function shouldHidePreApplicationFromAdmin/)
  assert.match(helperSource, /export function filterAdminVisiblePreApplicationStatuses/)
  assert.match(helperSource, /SUPER_ADMIN/)
  assert.match(helperSource, /ARCHIVED/)
})

test("admin pre-application routes use archived visibility helper", () => {
  const routeSources = [
    listRouteSource,
    exportRouteSource,
    historyRouteSource,
    fingerprintRouteSource,
    duplicateCheckRouteSource,
    reviewRequestRouteSource,
    notesRouteSource,
    noteDetailRouteSource,
  ]

  for (const source of routeSources) {
    assert.match(source, /admin-archived-visibility/)
  }

  assert.match(
    listRouteSource,
    /canViewArchivedPreApplications|filterAdminVisiblePreApplicationStatuses|shouldHidePreApplicationFromAdmin/,
  )
  assert.match(
    exportRouteSource,
    /shouldHidePreApplicationFromAdmin|canViewArchivedPreApplications/,
  )
  assert.match(
    duplicateCheckRouteSource,
    /shouldHidePreApplicationFromAdmin\(currentRecord\.status, user\.role\)/,
  )
  assert.doesNotMatch(
    duplicateCheckRouteSource,
    /status:\s*\{\s*not:\s*ARCHIVED_PRE_APPLICATION_STATUS\s*\}/,
  )
  assert.match(
    fingerprintRouteSource,
    /ARCHIVED_PRE_APPLICATION_STATUS|canViewArchivedPreApplications/,
  )
  assert.match(fingerprintRouteSource, /fingerprintRiskClusterMember/)
  assert.match(fingerprintRouteSource, /riskCluster/)
})

test("admin pre-application table hides archived filter and stats behind super-admin gate", () => {
  assert.match(tableSource, /const isSuperAdmin = currentUserRole === "SUPER_ADMIN"/)
  assert.match(tableSource, /isSuperAdmin\s*\?\s*\[\{ value: "ARCHIVED"/)
  assert.match(tableSource, /\{isSuperAdmin && \(/)
  assert.match(tableSource, /setStatusFilter\(\["ARCHIVED"\]\)/)
})
