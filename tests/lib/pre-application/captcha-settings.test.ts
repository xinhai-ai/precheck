import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const schemaSource = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8")
const systemConfigRouteSource = readFileSync(
  new URL("../../../app/api/admin/system-config/route.ts", import.meta.url),
  "utf8",
)
const settingsFormSource = readFileSync(
  new URL("../../../components/admin/settings-form.tsx", import.meta.url),
  "utf8",
)
const zhDictSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("site settings schema includes pre-application captcha fields", () => {
  assert.match(schemaSource, /preApplicationCaptchaEnabled\s+Boolean\s+@default\(false\)/)
  assert.match(schemaSource, /preApplicationCaptchaProvider\s+String\?/) 
})

test("admin system config reads and writes submit captcha settings", () => {
  assert.match(systemConfigRouteSource, /preApplicationCaptchaEnabled:\s*z\.boolean\(\)\.optional\(\)/)
  assert.match(
    systemConfigRouteSource,
    /preApplicationCaptchaProvider:\s*z\.enum\(\["turnstile",\s*"hcaptcha",\s*"geetest"\]\)\.optional\(\)\.nullable\(\)/,
  )
  assert.match(systemConfigRouteSource, /preApplicationCaptchaEnabled:\s*true/)
  assert.match(systemConfigRouteSource, /preApplicationCaptchaProvider:\s*true/)
})

test("settings form exposes captcha toggle and provider selector", () => {
  assert.match(settingsFormSource, /preApplicationCaptchaEnabled:\s*boolean/)
  assert.match(settingsFormSource, /preApplicationCaptchaProvider:\s*"turnstile"\s*\|\s*"hcaptcha"\s*\|\s*"geetest"\s*\|\s*null/)
  assert.match(settingsFormSource, /t\.preApplicationCaptchaEnabled/)
  assert.match(settingsFormSource, /t\.preApplicationCaptchaProvider/)
})

test("captcha settings copy exists in both dictionaries", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"preApplicationCaptchaEnabled"\s*:/)
    assert.match(source, /"preApplicationCaptchaEnabledDesc"\s*:/)
    assert.match(source, /"preApplicationCaptchaProvider"\s*:/)
    assert.match(source, /"preApplicationCaptchaProviderDesc"\s*:/)
    assert.match(source, /"preApplicationCaptchaProviderTurnstile"\s*:/)
    assert.match(source, /"preApplicationCaptchaProviderHcaptcha"\s*:/)
    assert.match(source, /"preApplicationCaptchaProviderGeetest"\s*:/)
  }
})
