import test from "node:test"
import assert from "node:assert/strict"

const { DEFAULT_ESSAY_MIN_LENGTH, DEFAULT_ESSAY_MAX_LENGTH, normalizeEssayLengthLimits } =
  await import(new URL("../../../lib/pre-application/essay-limits-utils.ts", import.meta.url).href)

test("uses defaults when values are missing", () => {
  const limits = normalizeEssayLengthLimits(undefined, undefined)
  assert.deepEqual(limits, {
    min: DEFAULT_ESSAY_MIN_LENGTH,
    max: DEFAULT_ESSAY_MAX_LENGTH,
  })
})

test("keeps valid configured limits", () => {
  const limits = normalizeEssayLengthLimits(80, 260)
  assert.deepEqual(limits, { min: 80, max: 260 })
})

test("falls back to defaults when min is greater than max", () => {
  const limits = normalizeEssayLengthLimits(400, 200)
  assert.deepEqual(limits, {
    min: DEFAULT_ESSAY_MIN_LENGTH,
    max: DEFAULT_ESSAY_MAX_LENGTH,
  })
})

test("clamps extreme values to safe bounds", () => {
  const limits = normalizeEssayLengthLimits(-5, 999999)
  assert.deepEqual(limits, { min: 1, max: 5000 })
})
