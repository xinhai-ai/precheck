import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

test("captcha verifier and provider files exist", () => {
  assert.equal(existsSync(new URL("../../lib/captcha/verify.ts", import.meta.url)), true)
  assert.equal(existsSync(new URL("../../lib/captcha/providers/hcaptcha.ts", import.meta.url)), true)
  assert.equal(existsSync(new URL("../../lib/captcha/providers/geetest.ts", import.meta.url)), true)
})

test("submit APIs use shared captcha verification", () => {
  const loggedInRoute = readFileSync(new URL("../../app/api/pre-application/route.ts", import.meta.url), "utf8")
  const guestRoute = readFileSync(new URL("../../app/api/guest/apply/route.ts", import.meta.url), "utf8")

  assert.match(loggedInRoute, /verifyCaptchaChallenge/)
  assert.match(guestRoute, /verifyCaptchaChallenge/)
})
