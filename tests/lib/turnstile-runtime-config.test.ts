import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const registerPageSource = readFileSync(
  new URL("../../app/[locale]/(public)/register/page.tsx", import.meta.url),
  "utf8",
)
const loginPageSource = readFileSync(
  new URL("../../app/[locale]/(minimal)/login/page.tsx", import.meta.url),
  "utf8",
)
const registerFormSource = readFileSync(
  new URL("../../components/auth/register-form.tsx", import.meta.url),
  "utf8",
)
const loginFormSource = readFileSync(
  new URL("../../components/auth/login-form.tsx", import.meta.url),
  "utf8",
)
const healthRouteSource = readFileSync(new URL("../../app/api/health/route.ts", import.meta.url), "utf8")

test("auth pages pass a runtime turnstile site key into client forms", () => {
  assert.match(registerPageSource, /getTurnstileConfig/)
  assert.match(registerPageSource, /turnstileSiteKey=/)
  assert.match(loginPageSource, /getTurnstileConfig/)
  assert.match(loginPageSource, /turnstileSiteKey=/)
})

test("auth forms derive turnstile availability from props instead of build-time env", () => {
  assert.match(registerFormSource, /turnstileSiteKey:\s*string/)
  assert.doesNotMatch(registerFormSource, /const TURNSTILE_SITE_KEY = process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY/)
  assert.match(registerFormSource, /const turnstileEnabled = Boolean\(turnstileSiteKey\)/)

  assert.match(loginFormSource, /turnstileSiteKey:\s*string/)
  assert.doesNotMatch(loginFormSource, /const TURNSTILE_SITE_KEY = process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY/)
  assert.match(loginFormSource, /const turnstileEnabled = Boolean\(turnstileSiteKey\)/)
})

test("health route checks both public and secret turnstile keys", () => {
  assert.match(healthRouteSource, /getTurnstileConfig/)
  assert.match(healthRouteSource, /turnstile\.enabled/)
  assert.doesNotMatch(healthRouteSource, /const configured = !!process\.env\.TURNSTILE_SECRET_KEY/)
})
