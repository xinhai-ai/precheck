import test from "node:test"
import assert from "node:assert/strict"

const { getCapabilitiesForRole, hasCapability } = await import(
  new URL("../../../lib/auth/capabilities.ts", import.meta.url).href
)

test("ADMIN can review applications and review appeals", () => {
  assert.equal(hasCapability("ADMIN", "preApplication.review"), true)
  assert.equal(hasCapability("ADMIN", "preApplication.archive"), true)
  assert.equal(hasCapability("ADMIN", "preApplicationAppeal.view"), true)
  assert.equal(hasCapability("ADMIN", "preApplicationAppeal.review"), true)
})

test("SUPER_ADMIN can review appeals but cannot perform ordinary application review", () => {
  assert.equal(hasCapability("SUPER_ADMIN", "preApplication.review"), false)
  assert.equal(hasCapability("SUPER_ADMIN", "preApplication.archive"), true)
  assert.equal(hasCapability("SUPER_ADMIN", "preApplicationAppeal.view"), true)
  assert.equal(hasCapability("SUPER_ADMIN", "preApplicationAppeal.review"), true)
})

test("USER and empty roles have no admin capabilities", () => {
  assert.deepEqual(getCapabilitiesForRole("USER"), [])
  assert.equal(hasCapability("USER", "preApplicationAppeal.review"), false)
  assert.equal(hasCapability(null, "preApplicationAppeal.review"), false)
  assert.equal(hasCapability(undefined, "preApplicationAppeal.review"), false)
})
