import test from "node:test"
import assert from "node:assert/strict"

const {
  PRE_APPLICATION_SUBMIT_BAN_MAX_DAYS,
  PRE_APPLICATION_SUBMIT_BAN_MIN_DAYS,
  normalizeSubmitBanDays,
  getSubmitBanUntilFromDays,
  getSubmitBanRemainingSeconds,
  isSubmitBanActive,
} = await import(new URL("../../../lib/pre-application/submit-ban-utils.ts", import.meta.url).href)

test("normalizeSubmitBanDays accepts integer days in range", () => {
  assert.equal(normalizeSubmitBanDays(PRE_APPLICATION_SUBMIT_BAN_MIN_DAYS), 1)
  assert.equal(normalizeSubmitBanDays(30), 30)
  assert.equal(normalizeSubmitBanDays(PRE_APPLICATION_SUBMIT_BAN_MAX_DAYS), 3650)
})

test("normalizeSubmitBanDays rejects invalid values", () => {
  assert.equal(normalizeSubmitBanDays(0), null)
  assert.equal(normalizeSubmitBanDays(PRE_APPLICATION_SUBMIT_BAN_MAX_DAYS + 1), null)
  assert.equal(normalizeSubmitBanDays(1.5), null)
  assert.equal(normalizeSubmitBanDays("1"), null)
  assert.equal(normalizeSubmitBanDays(null), null)
})

test("getSubmitBanUntilFromDays adds rolling 24h duration", () => {
  const now = new Date("2026-03-05T12:30:00.000Z")
  const bannedUntil = getSubmitBanUntilFromDays(2, now)

  assert.equal(bannedUntil.toISOString(), "2026-03-07T12:30:00.000Z")
})

test("getSubmitBanRemainingSeconds returns ceiling seconds and never negative", () => {
  const now = new Date("2026-03-05T12:30:00.000Z")
  const until = new Date("2026-03-05T12:30:10.100Z")

  assert.equal(getSubmitBanRemainingSeconds(until, now), 11)
  assert.equal(getSubmitBanRemainingSeconds(new Date("2026-03-05T12:29:59.000Z"), now), 0)
})

test("isSubmitBanActive checks remaining seconds", () => {
  const now = new Date("2026-03-05T12:30:00.000Z")

  assert.equal(isSubmitBanActive(new Date("2026-03-05T12:30:01.000Z"), now), true)
  assert.equal(isSubmitBanActive(new Date("2026-03-05T12:30:00.000Z"), now), false)
  assert.equal(isSubmitBanActive(null, now), false)
})
