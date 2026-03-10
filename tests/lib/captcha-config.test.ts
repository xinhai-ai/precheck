import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const healthRouteSource = readFileSync(new URL("../../app/api/health/route.ts", import.meta.url), "utf8")

test("captcha runtime config helper exists", () => {
  assert.equal(existsSync(new URL("../../lib/captcha/config.ts", import.meta.url)), true)
})

test("health route checks captcha providers through shared config", () => {
  assert.match(healthRouteSource, /getCaptchaProvidersHealth|getCaptchaProviderConfig|getCaptchaRuntimeHealth/)
  assert.doesNotMatch(healthRouteSource, /turnstile:\s*checkTurnstile\(\)/)
})
