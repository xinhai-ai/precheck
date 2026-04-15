import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const routePath = new URL("../../app/api/admin/manual-outbound/route.ts", import.meta.url)
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : ""
const errorKeysSource = readFileSync(
  new URL("../../lib/api/error-keys.ts", import.meta.url),
  "utf8",
)
const openApiSource = readFileSync(new URL("../../lib/openapi-spec.ts", import.meta.url), "utf8")

test("manual outbound route is super-admin only and documented in openapi", () => {
  assert.match(routeSource, /isSuperAdmin/)
  assert.match(routeSource, /sendManualOutbound/)
  assert.match(errorKeysSource, /manualOutbound:/)
  assert.match(openApiSource, /"\/admin\/manual-outbound":\s*\{/)
  assert.match(openApiSource, /emails:\s*\{/)
})
