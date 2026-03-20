import test from "node:test"
import assert from "node:assert/strict"

async function loadFingerprintMetadataModule() {
  return import(new URL("../../../lib/fingerprint/metadata.ts", import.meta.url).href)
}

test("normalizeBrowserFamily marks Safari user agents as SAFARI", async () => {
  const { normalizeBrowserFamily } = await loadFingerprintMetadataModule()

  assert.equal(
    normalizeBrowserFamily(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    ),
    "SAFARI",
  )
})

test("normalizeBrowserFamily detects iOS Chrome before Safari fallback", async () => {
  const { normalizeBrowserFamily } = await loadFingerprintMetadataModule()

  assert.equal(
    normalizeBrowserFamily(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/134.0.0.0 Mobile/15E148 Safari/604.1",
    ),
    "CHROME",
  )
})

test("buildNetworkKey normalizes ipv4 /24 keys", async () => {
  const { buildNetworkKey } = await loadFingerprintMetadataModule()

  assert.equal(buildNetworkKey("203.0.113.42"), "203.0.113.0/24")
})

test("buildNetworkKey returns null for invalid input", async () => {
  const { buildNetworkKey } = await loadFingerprintMetadataModule()

  assert.equal(buildNetworkKey("not-an-ip"), null)
})
