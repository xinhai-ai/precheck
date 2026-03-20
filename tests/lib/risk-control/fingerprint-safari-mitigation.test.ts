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
const openApiSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const riskCenterSource = readFileSync(
  new URL("../../../components/admin/risk-control-center.tsx", import.meta.url),
  "utf8",
)
const zhDictSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("fingerprint events store normalized browser and network metadata", () => {
  assert.match(schemaSource, /browserFamily\s+String\?/)
  assert.match(schemaSource, /networkKey\s+String\?/)
  assert.match(schemaSource, /@@index\(\[browserFamily, createdAt\]\)/)
  assert.match(schemaSource, /@@index\(\[networkKey, createdAt\]\)/)
})

test("fingerprint event recording derives and stores browser/network metadata", () => {
  assert.match(serverSource, /normalizeBrowserFamily\(userAgent\)/)
  assert.match(serverSource, /buildNetworkKey\(ip\)/)
  assert.match(serverSource, /browserFamily,/)
  assert.match(serverSource, /networkKey,/)
})

test("risk group routes compute Safari-aware evidence and explanation fields", () => {
  assert.match(listRouteSource, /browserFamily:\s*true/)
  assert.match(listRouteSource, /networkKey:\s*true/)
  assert.match(listRouteSource, /computeFingerprintRiskAssessment/)
  assert.match(listRouteSource, /browserConfidence/)
  assert.match(listRouteSource, /evidenceFlags/)
  assert.match(detailRouteSource, /riskExplanation/)
  assert.match(detailRouteSource, /browserFamily:\s*true/)
  assert.match(detailRouteSource, /networkKey:\s*true/)
})

test("openapi documents Safari-aware fingerprint risk fields", () => {
  assert.match(openApiSource, /browserConfidence/)
  assert.match(openApiSource, /evidenceFlags/)
  assert.match(openApiSource, /riskExplanation/)
})

test("risk control center shows browser confidence, evidence labels, and explanation", () => {
  assert.match(riskCenterSource, /browserConfidence/)
  assert.match(riskCenterSource, /evidenceFlags/)
  assert.match(riskCenterSource, /riskExplanation/)
  assert.match(riskCenterSource, /networkKey/)
})

test("risk control dictionaries include Safari-aware labels", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"browserConfidence"\s*:/)
    assert.match(source, /"highConfidence"\s*:/)
    assert.match(source, /"lowConfidence"\s*:/)
    assert.match(source, /"riskExplanation"\s*:/)
    assert.match(source, /"signalRecentConcentration"\s*:/)
    assert.match(source, /"signalNetworkOverlap"\s*:/)
    assert.match(source, /"signalCrossEventContinuity"\s*:/)
  }
})
