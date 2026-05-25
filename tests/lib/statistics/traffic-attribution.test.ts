import test from "node:test"
import assert from "node:assert/strict"

async function loadTrafficAttributionModule() {
  return import(new URL("../../../lib/statistics/traffic-attribution.ts", import.meta.url).href)
}

test("parseTrafficAttribution keeps referer host and hashes sensitive url details", async () => {
  const { parseTrafficAttribution } = await loadTrafficAttributionModule()

  const attribution = await parseTrafficAttribution({
    requestUrl: "https://precheck.example.com/zh/register?utm_source=newsletter&utm_medium=email&utm_campaign=launch",
    referer: "https://linux.do/t/precheck-launch?token=secret-value",
  })

  assert.equal(attribution.utmSource, "newsletter")
  assert.equal(attribution.utmMedium, "email")
  assert.equal(attribution.utmCampaign, "launch")
  assert.equal(attribution.referrerHost, "linux.do")
  assert.equal(attribution.referrerOrigin, "https://linux.do")
  assert.equal(attribution.referrerCategory, "community")
  assert.match(attribution.referrerUrlHash ?? "", /^[a-f0-9]{64}$/)
  assert.match(attribution.referrerPathHash ?? "", /^[a-f0-9]{64}$/)
  assert.equal(attribution.landingPath, "/zh/register")
})

test("resolvePrimarySource prefers explicit campaign and invite sources before referer", async () => {
  const { resolvePrimarySource } = await loadTrafficAttributionModule()

  assert.deepEqual(
    resolvePrimarySource({
      utmSource: "newsletter",
      inviteCode: "INVITE-2026",
      oauthProvider: "linuxdo",
      preApplicationSource: "BILIBILI",
      referrerHost: "linux.do",
    }),
    { type: "utm", name: "newsletter" },
  )

  assert.deepEqual(
    resolvePrimarySource({
      inviteCode: "INVITE-2026",
      oauthProvider: "linuxdo",
      preApplicationSource: "BILIBILI",
      referrerHost: "linux.do",
    }),
    { type: "invite", name: "INVITE-2026" },
  )

  assert.deepEqual(
    resolvePrimarySource({
      referrerHost: "linux.do",
    }),
    { type: "referer", name: "linux.do" },
  )
})

test("maskSensitiveValue returns stable masked display values", async () => {
  const { maskEmail, maskIp, maskHash } = await loadTrafficAttributionModule()

  assert.equal(maskEmail("alice@example.com"), "a***e@example.com")
  assert.equal(maskEmail("a@example.com"), "a***@example.com")
  assert.equal(maskIp("203.0.113.42"), "203.0.113.*")
  assert.equal(maskIp("2001:db8::1"), "2001:db8:****")
  assert.equal(maskHash("1234567890abcdef"), "12345678…cdef")
})
