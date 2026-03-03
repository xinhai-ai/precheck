import test from "node:test"
import assert from "node:assert/strict"

const {
  SHADOW_HIDDEN_STATUS,
  mapStatusForUserView,
  shouldPersistAsShadowHidden,
  isShadowHiddenLockedForAdminMutation,
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
