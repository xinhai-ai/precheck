import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const duplicateRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/[id]/duplicate-check/route.ts", import.meta.url),
  "utf8",
)
const adminTableSource = readFileSync(
  new URL("../../../components/admin/pre-applications-table.tsx", import.meta.url),
  "utf8",
)
const aiReviewRouteUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/ai-review/route.ts",
  import.meta.url,
)

test("duplicate check route is local-only and scans 1000 candidates", () => {
  assert.doesNotMatch(duplicateRouteSource, /compareSimilarityWithAI/)
  assert.doesNotMatch(duplicateRouteSource, /isCloudflareAIConfigured/)
  assert.match(duplicateRouteSource, /take:\s*1000/)
  assert.doesNotMatch(duplicateRouteSource, /aiEnabled/)
  assert.doesNotMatch(duplicateRouteSource, /aiReason/)
})

test("admin detail dialog auto-runs duplicate check without AI review UI", () => {
  assert.doesNotMatch(
    adminTableSource,
    /\/api\/admin\/pre-applications\/\$\{selected\.id\}\/ai-review/,
  )
  assert.doesNotMatch(adminTableSource, /AIReviewResult/)
  assert.doesNotMatch(adminTableSource, /aiReviewLoading/)
  assert.match(
    adminTableSource,
    /useEffect\(\(\) => \{[\s\S]*dialogOpen[\s\S]*handleDuplicateCheck\(/,
  )
})

test("standalone ai review route is removed", () => {
  assert.equal(existsSync(aiReviewRouteUrl), false)
})
