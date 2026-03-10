import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const templateSource = readFileSync(
  new URL("../../../lib/email/templates.ts", import.meta.url),
  "utf8",
)
const routeSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/[id]/review/route.ts", import.meta.url),
  "utf8",
)
const zhSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("appeal review email template builder exists", () => {
  assert.match(templateSource, /buildPreApplicationAppealReviewEmail/)
})

test("appeal review route sends email and returns email result fields", () => {
  assert.match(routeSource, /buildPreApplicationAppealReviewEmail/)
  assert.match(routeSource, /sendEmail/)
  assert.match(routeSource, /emailSent/)
  assert.match(routeSource, /emailError/)
})

test("appeal review email templates exist in both dictionaries", () => {
  for (const source of [zhSource, enSource]) {
    assert.match(source, /"appealEmailTemplate"\s*:/)
    assert.match(source, /"approved"\s*:\s*\{[\s\S]*?"subject"\s*:/)
    assert.match(source, /"rejected"\s*:\s*\{[\s\S]*?"subject"\s*:/)
  }
})
