import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layoutSource = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8")
const envExampleSource = readFileSync(new URL("../../.env.example", import.meta.url), "utf8")

test("locale metadata reads google verification from server env", () => {
  assert.match(layoutSource, /process\.env\.GOOGLE_SITE_VERIFICATION/)
  assert.doesNotMatch(layoutSource, /your-google-verification-code/)
})

test("env example documents google verification token", () => {
  assert.match(envExampleSource, /GOOGLE_SITE_VERIFICATION/)
})
