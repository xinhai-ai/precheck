import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const ticketHelperSource = new URL(
  "../../../lib/pre-application/captcha-ticket.ts",
  import.meta.url,
)
const precheckRouteSource = readFileSync(
  new URL("../../../app/api/pre-application/precheck/route.ts", import.meta.url),
  "utf8",
)
const submitRouteSource = readFileSync(
  new URL("../../../app/api/pre-application/route.ts", import.meta.url),
  "utf8",
)
const dashboardFormSource = readFileSync(
  new URL("../../../components/dashboard/pre-application-form.tsx", import.meta.url),
  "utf8",
)

test("captcha ticket helper exists", () => {
  assert.equal(existsSync(ticketHelperSource), true)
})

test("precheck only exposes captcha config after eligibility passes and issues a ticket", () => {
  assert.match(precheckRouteSource, /issuePreApplicationCaptchaTicket/)
  assert.match(precheckRouteSource, /eligibility\.allowed\s*&&\s*runtimeCaptcha\.enabled/)
  assert.match(precheckRouteSource, /captchaTicket/)
})

test("formal submit requires and consumes captcha ticket on the backend", () => {
  assert.match(
    submitRouteSource,
    /captchaTicket:\s*z\.string\(\)\.min\(1\)\.max\(200\)\.optional\(\)\.nullable\(\)/,
  )
  assert.match(submitRouteSource, /consumePreApplicationCaptchaTicket/)
  assert.match(submitRouteSource, /验证码票据无效或已过期，请重新提交/)
})

test("dashboard form carries captcha ticket from precheck into formal submit", () => {
  assert.match(dashboardFormSource, /captchaTicket: string \| null/)
  assert.match(dashboardFormSource, /setCaptchaTicket/)
  assert.match(dashboardFormSource, /captchaTicket: data\.captchaTicket \?\? null/)
  assert.match(dashboardFormSource, /captchaTicket: captcha\?\.ticket \?\? null/)
})
