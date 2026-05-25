import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const listRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/route.ts", import.meta.url),
  "utf8",
)
const reviewRouteSource = readFileSync(
  new URL(
    "../../../app/api/admin/pre-application-appeals/[id]/review/route.ts",
    import.meta.url,
  ),
  "utf8",
)
const pageSource = readFileSync(
  new URL("../../../app/[locale]/admin/pre-application-appeals/page.tsx", import.meta.url),
  "utf8",
)
const tableSource = readFileSync(
  new URL("../../../components/admin/pre-application-appeals-table.tsx", import.meta.url),
  "utf8",
)

test("appeal list route uses capability policy and excludes archived applications", () => {
  assert.match(listRouteSource, /canViewPreApplicationAppeals/)
  assert.doesNotMatch(listRouteSource, /isSuperAdmin/)
  assert.match(listRouteSource, /PreApplicationStatus\.ARCHIVED/)
  assert.match(listRouteSource, /getPreApplicationAppealReviewPolicy/)
  assert.match(listRouteSource, /reviewPolicy/)
})

test("appeal review route uses resource policy instead of super-admin-only gate", () => {
  assert.match(reviewRouteSource, /getPreApplicationAppealReviewPolicy/)
  assert.match(reviewRouteSource, /getPreApplicationAppealReviewDeniedStatus/)
  assert.doesNotMatch(reviewRouteSource, /isSuperAdmin/)
})

test("appeal admin page and table consume capability review state", () => {
  assert.match(pageSource, /canViewPreApplicationAppeals/)
  assert.doesNotMatch(pageSource, /role !== "SUPER_ADMIN"/)
  assert.match(tableSource, /reviewPolicy/)
  assert.match(tableSource, /policyReasons/)
})
