import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const schemaSource = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8")
const serverSource = readFileSync(
  new URL("../../../lib/fingerprint/server.ts", import.meta.url),
  "utf8",
)
const listRouteSource = readFileSync(
  new URL("../../../app/api/admin/risk-control/fingerprint-groups/route.ts", import.meta.url),
  "utf8",
)
const detailRouteSource = readFileSync(
  new URL(
    "../../../app/api/admin/risk-control/fingerprint-groups/[fingerprintHash]/route.ts",
    import.meta.url,
  ),
  "utf8",
)
const riskCenterSource = readFileSync(
  new URL("../../../components/admin/risk-control-center.tsx", import.meta.url),
  "utf8",
)
const openApiSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const zhDictSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("schema stores full fingerprint components and similarity fields", () => {
  assert.match(schemaSource, /fingerprintBasis\s+Json\?/)
  assert.match(schemaSource, /componentKeys\s+String\[\]/)
  assert.match(schemaSource, /fingerprintComponents\s+Json\?/)
  assert.match(schemaSource, /fingerprintSummary\s+Json\?/)
  assert.match(schemaSource, /similarityScore\s+Int\?/)
  assert.match(schemaSource, /similaritySignals\s+Json\?/)
  assert.match(schemaSource, /@@index\(\[similarityScore, createdAt\]\)/)
})

test("server records component binding and similarity evidence", () => {
  assert.match(serverSource, /buildFingerprintBinding/)
  assert.match(serverSource, /selectBestFingerprintSimilarity/)
  assert.match(serverSource, /fingerprintComponents:/)
  assert.match(serverSource, /fingerprintSummary:/)
  assert.match(serverSource, /similarityScore:/)
  assert.match(serverSource, /similaritySignals:/)
})

test("admin routes return component summaries and similar events", () => {
  assert.match(listRouteSource, /maxSimilarityScore/)
  assert.match(listRouteSource, /fingerprintSummary/)
  assert.match(detailRouteSource, /fingerprintComponents/)
  assert.match(detailRouteSource, /similarEvents/)
  assert.match(detailRouteSource, /similaritySignals/)
})

test("risk control UI renders component details and similarity evidence", () => {
  assert.match(riskCenterSource, /similarityScore/)
  assert.match(riskCenterSource, /similarEvents/)
  assert.match(riskCenterSource, /fingerprintComponents/)
  assert.match(riskCenterSource, /componentDetails/)
  assert.match(riskCenterSource, /matchedComponents/)
})

test("openapi and dictionaries include server-bound fingerprint labels", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"similarityScore"\s*:/)
    assert.match(source, /"similarEvents"\s*:/)
    assert.match(source, /"componentDetails"\s*:/)
    assert.match(source, /"matchedComponents"\s*:/)
    assert.match(source, /"differentComponents"\s*:/)
  }

  assert.match(openApiSource, /fingerprintComponents/)
  assert.match(openApiSource, /similarityScore/)
  assert.match(openApiSource, /similarEvents/)
})
