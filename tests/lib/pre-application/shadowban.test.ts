import test from "node:test"
import assert from "node:assert/strict"

const {
  SHADOW_HIDDEN_STATUS,
  mapStatusForUserView,
  shouldPersistAsShadowHidden,
  isShadowHiddenLockedForAdminMutation,
  shouldShadowHideStatus,
} = await import(new URL("../../../lib/pre-application/shadowban.ts", import.meta.url).href)

test("mapStatusForUserView maps SHADOW_HIDDEN to PENDING", () => {
  assert.equal(mapStatusForUserView(SHADOW_HIDDEN_STATUS), "PENDING")
})

test("shadow hidden records are locked for admin mutation", () => {
  assert.equal(isShadowHiddenLockedForAdminMutation("SHADOW_HIDDEN"), true)
  assert.equal(isShadowHiddenLockedForAdminMutation("PENDING"), false)
})

test("submission status is shadow hidden when user is shadowbanned", () => {
  assert.equal(shouldPersistAsShadowHidden(true), "SHADOW_HIDDEN")
  assert.equal(shouldPersistAsShadowHidden(false), "PENDING")
})

test("non shadow statuses remain unchanged in mapStatusForUserView", () => {
  assert.equal(mapStatusForUserView("APPROVED"), "APPROVED")
})

test("mapStatusForUserView prefers latest version status when record is shadow hidden", () => {
  assert.equal(mapStatusForUserView(SHADOW_HIDDEN_STATUS, "REJECTED"), "REJECTED")
  assert.equal(mapStatusForUserView(SHADOW_HIDDEN_STATUS, "APPROVED"), "APPROVED")
  assert.equal(mapStatusForUserView(SHADOW_HIDDEN_STATUS, SHADOW_HIDDEN_STATUS), "PENDING")
})

test("shouldShadowHideStatus only hides active workflow statuses", () => {
  assert.equal(shouldShadowHideStatus("PENDING"), true)
  assert.equal(shouldShadowHideStatus("DISPUTED"), true)
  assert.equal(shouldShadowHideStatus("PENDING_REVIEW"), true)
  assert.equal(shouldShadowHideStatus("ON_HOLD"), true)
  assert.equal(shouldShadowHideStatus("REJECTED"), false)
  assert.equal(shouldShadowHideStatus("APPROVED"), false)
})
