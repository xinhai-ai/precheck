import test from "node:test"
import assert from "node:assert/strict"

const { buildBanStatusPayload } = await import(new URL("../../lib/user-ban-utils.ts", import.meta.url).href)

test("buildBanStatusPayload returns ACTIVE with null reason when unbanning", () => {
  const payload = buildBanStatusPayload({
    isCurrentlyBanned: true,
    banReasonInput: "ignored",
  })

  assert.deepEqual(payload, {
    status: "ACTIVE",
    banReason: null,
  })
})

test("buildBanStatusPayload trims optional reason when banning", () => {
  const payload = buildBanStatusPayload({
    isCurrentlyBanned: false,
    banReasonInput: "  abuse / spam  ",
  })

  assert.deepEqual(payload, {
    status: "BANNED",
    banReason: "abuse / spam",
  })
})

test("buildBanStatusPayload maps empty reason to null when banning", () => {
  const payload = buildBanStatusPayload({
    isCurrentlyBanned: false,
    banReasonInput: "   ",
  })

  assert.deepEqual(payload, {
    status: "BANNED",
    banReason: null,
  })
})

test("buildBanStatusPayload returns null when ban is cancelled", () => {
  const payload = buildBanStatusPayload({
    isCurrentlyBanned: false,
    banReasonInput: null,
  })

  assert.equal(payload, null)
})
