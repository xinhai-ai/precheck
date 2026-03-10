import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const submitRouteSource = readFileSync(
  new URL("../../../app/api/pre-application/route.ts", import.meta.url),
  "utf8",
)

test("edit cooldown is applied after captcha validation in PUT flow", () => {
  const putStart = submitRouteSource.indexOf("export async function PUT")
  assert.notEqual(putStart, -1)

  const putSection = submitRouteSource.slice(putStart)
  const captchaValidationIndex = putSection.indexOf(
    "const captchaError = await validatePreApplicationSubmitCaptcha(request, user.id, data)",
  )
  const editCooldownIndex = putSection.indexOf("const key = `pre-app:edit-rate:${user.id}`")

  assert.notEqual(captchaValidationIndex, -1)
  assert.notEqual(editCooldownIndex, -1)
  assert.ok(
    captchaValidationIndex < editCooldownIndex,
    "PUT flow should validate captcha before writing the 5-minute edit cooldown key",
  )
})
