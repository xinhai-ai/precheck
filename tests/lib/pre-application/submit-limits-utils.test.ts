import test from "node:test"
import assert from "node:assert/strict"

const {
  DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
  DEFAULT_PREAPP_DAILY_USER_LIMIT,
  DEFAULT_PREAPP_SUBMIT_START_TIME,
  DEFAULT_PREAPP_SUBMIT_END_TIME,
  normalizeSubmitLimits,
  isWithinShanghaiSubmitWindow,
  getShanghaiDayQuotaInfo,
  parseSubmitTimeToMinutes,
  isValidSubmitWindow,
} = await import(new URL("../../../lib/pre-application/submit-limits-utils.ts", import.meta.url).href)

test("normalizeSubmitLimits uses defaults", () => {
  const normalized = normalizeSubmitLimits({})
  assert.equal(normalized.dailyGlobalLimit, DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT)
  assert.equal(normalized.dailyUserLimit, DEFAULT_PREAPP_DAILY_USER_LIMIT)
  assert.equal(normalized.submitStartTime, DEFAULT_PREAPP_SUBMIT_START_TIME)
  assert.equal(normalized.submitEndTime, DEFAULT_PREAPP_SUBMIT_END_TIME)
})

test("normalizeSubmitLimits keeps configured limits", () => {
  const normalized = normalizeSubmitLimits({
    dailyGlobalLimit: 100,
    dailyUserLimit: 8,
    submitStartTime: "10:00",
    submitEndTime: "22:30",
  })

  assert.deepEqual(normalized, {
    dailyGlobalLimit: 100,
    dailyUserLimit: 8,
    submitStartTime: "10:00",
    submitEndTime: "22:30",
  })
})

test("normalizeSubmitLimits falls back when start >= end", () => {
  const normalized = normalizeSubmitLimits({
    submitStartTime: "21:00",
    submitEndTime: "09:00",
  })

  assert.equal(normalized.submitStartTime, DEFAULT_PREAPP_SUBMIT_START_TIME)
  assert.equal(normalized.submitEndTime, DEFAULT_PREAPP_SUBMIT_END_TIME)
})

test("parseSubmitTimeToMinutes parses valid HH:mm", () => {
  assert.equal(parseSubmitTimeToMinutes("00:00"), 0)
  assert.equal(parseSubmitTimeToMinutes("09:30"), 570)
  assert.equal(parseSubmitTimeToMinutes("23:59"), 1439)
})

test("isValidSubmitWindow validates increasing range", () => {
  assert.equal(isValidSubmitWindow("09:00", "21:00"), true)
  assert.equal(isValidSubmitWindow("21:00", "21:00"), false)
  assert.equal(isValidSubmitWindow("22:00", "21:00"), false)
})

test("window is left-closed right-open [09:00, 21:00)", () => {
  const atStart = new Date("2026-03-04T01:00:00.000Z") // 09:00 Asia/Shanghai
  const atEnd = new Date("2026-03-04T13:00:00.000Z") // 21:00 Asia/Shanghai
  const beforeEnd = new Date("2026-03-04T12:59:59.000Z") // 20:59:59 Asia/Shanghai

  assert.equal(isWithinShanghaiSubmitWindow(atStart, "09:00", "21:00"), true)
  assert.equal(isWithinShanghaiSubmitWindow(beforeEnd, "09:00", "21:00"), true)
  assert.equal(isWithinShanghaiSubmitWindow(atEnd, "09:00", "21:00"), false)
})

test("getShanghaiDayQuotaInfo returns stable dayKey and positive ttl", () => {
  const info = getShanghaiDayQuotaInfo(new Date("2026-03-04T08:00:00.000Z")) // 16:00 Shanghai
  assert.equal(info.dayKey, "20260304")
  assert.equal(Number.isInteger(info.ttlSeconds), true)
  assert.equal(info.ttlSeconds > 0, true)
})

test("getShanghaiDayQuotaInfo ttl shrinks near midnight", () => {
  const info = getShanghaiDayQuotaInfo(new Date("2026-03-04T15:59:30.000Z")) // 23:59:30 Shanghai
  assert.equal(info.dayKey, "20260304")
  assert.equal(info.ttlSeconds > 0, true)
  assert.equal(info.ttlSeconds <= 30, true)
})
