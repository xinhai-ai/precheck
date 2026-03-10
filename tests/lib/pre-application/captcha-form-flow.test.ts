import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const dashboardFormSource = readFileSync(
  new URL("../../../components/dashboard/pre-application-form.tsx", import.meta.url),
  "utf8",
)
const guestFormSource = readFileSync(
  new URL("../../../components/guest/guest-apply-form.tsx", import.meta.url),
  "utf8",
)

test("shared captcha dialog component exists", () => {
  assert.equal(
    existsSync(new URL("../../../components/captcha/captcha-challenge-dialog.tsx", import.meta.url)),
    true,
  )
})

test("forms precheck before submit and use captcha dialog", () => {
  assert.match(dashboardFormSource, /\/api\/pre-application\/precheck/)
  assert.match(guestFormSource, /\/api\/guest\/apply\/precheck/)
  assert.match(dashboardFormSource, /CaptchaChallengeDialog/)
  assert.match(guestFormSource, /CaptchaChallengeDialog/)
})
