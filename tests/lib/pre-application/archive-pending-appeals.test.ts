import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const archiveRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/batch-archive/route.ts", import.meta.url),
  "utf8",
)
const reviewRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/[id]/review/route.ts", import.meta.url),
  "utf8",
)
const policySource = readFileSync(
  new URL("../../../lib/auth/policies/pre-application.ts", import.meta.url),
  "utf8",
)

test("batch archive route checks pending appeals before archiving", () => {
  assert.match(archiveRouteSource, /canArchivePreApplication/)
  assert.match(archiveRouteSource, /PreApplicationAppealStatus\.PENDING/)
  assert.match(archiveRouteSource, /pendingAppealCount/)
  assert.match(archiveRouteSource, /pendingAppealExists/)
})

test("ordinary pre-application review uses review capability", () => {
  assert.match(reviewRouteSource, /canReviewPreApplication/)
  assert.doesNotMatch(reviewRouteSource, /user\.role !== "ADMIN"/)
})

test("pre-application policy keeps SUPER_ADMIN outside ordinary review", () => {
  assert.match(policySource, /"preApplication\.review"/)
  assert.match(policySource, /MISSING_CAPABILITY/)
})
