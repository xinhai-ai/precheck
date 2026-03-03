import test from "node:test"
import assert from "node:assert/strict"

const { computeRiskLevel, sanitizeRiskSort } =
  await import(new URL("../../../lib/risk-control/fingerprint-risk.ts", import.meta.url).href)

test("computeRiskLevel returns HIGH for 3 users", () => {
  assert.equal(computeRiskLevel(3, 1), "HIGH")
})

test("computeRiskLevel returns MEDIUM for 2 applications", () => {
  assert.equal(computeRiskLevel(1, 2), "MEDIUM")
})

test("computeRiskLevel returns LOW below thresholds", () => {
  assert.equal(computeRiskLevel(1, 1), "LOW")
})

test("sanitizeRiskSort falls back to lastSeenAt desc", () => {
  assert.deepEqual(sanitizeRiskSort("bad", "bad"), { sortBy: "lastSeenAt", sortOrder: "desc" })
})

test("sanitizeRiskSort allows userCount asc", () => {
  assert.deepEqual(sanitizeRiskSort("userCount", "asc"), { sortBy: "userCount", sortOrder: "asc" })
})
