import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

test("shared precheck helper and routes exist", () => {
  assert.equal(existsSync(new URL("../../../lib/pre-application/submit-precheck.ts", import.meta.url)), true)
  assert.equal(existsSync(new URL("../../../app/api/pre-application/precheck/route.ts", import.meta.url)), true)
  assert.equal(existsSync(new URL("../../../app/api/guest/apply/precheck/route.ts", import.meta.url)), true)
})

test("submit routes expose captcha request fields", () => {
  const loggedInRoute = readFileSync(new URL("../../../app/api/pre-application/route.ts", import.meta.url), "utf8")
  const guestRoute = readFileSync(new URL("../../../app/api/guest/apply/route.ts", import.meta.url), "utf8")

  assert.match(loggedInRoute, /captchaProvider:\s*z\.enum\(\["turnstile",\s*"hcaptcha",\s*"geetest"\]\)\.optional\(\)\.nullable\(\)/)
  assert.match(loggedInRoute, /captchaPayload:\s*z\.record\(z\.string\(\),\s*z\.unknown\(\)\)\.optional\(\)\.nullable\(\)/)
  assert.match(guestRoute, /captchaProvider:\s*z\.enum\(\["turnstile",\s*"hcaptcha",\s*"geetest"\]\)\.optional\(\)\.nullable\(\)/)
  assert.match(guestRoute, /captchaPayload:\s*z\.record\(z\.string\(\),\s*z\.unknown\(\)\)\.optional\(\)\.nullable\(\)/)
})
