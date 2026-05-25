import test from "node:test"
import assert from "node:assert/strict"

async function loadPayloadModule() {
  return import(new URL("../../../lib/fingerprint/payload.ts", import.meta.url).href)
}

test("parseFingerprintPayload accepts server-bound components", async () => {
  const { parseFingerprintPayload } = await loadPayloadModule()
  const payload = parseFingerprintPayload({
    fingerprintStatus: "OK",
    fingerprintComponents: {
      browser: { timezone: "Asia/Shanghai" },
      graphics: { canvas: "abc" },
    },
  })

  assert.equal(payload.fingerprintStatus, "OK")
  assert.deepEqual(payload.fingerprintComponents, {
    browser: { timezone: "Asia/Shanghai" },
    graphics: { canvas: "abc" },
  })
})

test("parseFingerprintPayload keeps legacy visitor id compatibility", async () => {
  const { parseFingerprintPayload } = await loadPayloadModule()
  const payload = parseFingerprintPayload({
    fingerprintStatus: "OK",
    fingerprintVisitorId: "legacy-id",
  })

  assert.deepEqual(payload, {
    fingerprintStatus: "OK",
    fingerprintVisitorId: "legacy-id",
    fingerprintFailureReason: undefined,
  })
})

test("parseFingerprintPayload fails OK payload with no components or visitor id", async () => {
  const { parseFingerprintPayload } = await loadPayloadModule()
  const payload = parseFingerprintPayload({ fingerprintStatus: "OK" })

  assert.deepEqual(payload, {
    fingerprintStatus: "COLLECTION_FAILED",
    fingerprintFailureReason: "fingerprint_components_missing",
  })
})
