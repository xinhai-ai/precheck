import test from "node:test"
import assert from "node:assert/strict"

const allowedDomains = ["example.com"]

async function loadAvatarUrlModule() {
  return import(new URL("../../lib/avatar-url.ts", import.meta.url).href)
}

test("allow https avatar urls on the allowlisted domain or its subdomains", async () => {
  const { isAllowedAvatarUrl } = await loadAvatarUrlModule()
  assert.equal(isAllowedAvatarUrl("https://example.com/avatar.png", allowedDomains), true)
  assert.equal(isAllowedAvatarUrl("https://cdn.example.com/avatar.png", allowedDomains), true)
})

test("reject non-https, localhost, ip literals, and non-default ports", async () => {
  const { isAllowedAvatarUrl } = await loadAvatarUrlModule()
  assert.equal(isAllowedAvatarUrl("http://example.com/avatar.png", allowedDomains), false)
  assert.equal(isAllowedAvatarUrl("https://example.com:8443/avatar.png", allowedDomains), false)
  assert.equal(isAllowedAvatarUrl("https://127.0.0.1/avatar.png", allowedDomains), false)
  assert.equal(isAllowedAvatarUrl("https://localhost/avatar.png", allowedDomains), false)
})

test("getSafeAvatarUrl falls back to undefined for invalid or empty values", async () => {
  const { getSafeAvatarUrl } = await loadAvatarUrlModule()
  assert.equal(getSafeAvatarUrl("", allowedDomains), undefined)
  assert.equal(getSafeAvatarUrl("https://badexample.com/avatar.png", allowedDomains), undefined)
})
