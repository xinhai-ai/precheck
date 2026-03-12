import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const dashboardFormSource = readFileSync(
  new URL("../../../components/dashboard/pre-application-form.tsx", import.meta.url),
  "utf8",
)

test("dashboard pre-application form does not render the AI preview button", () => {
  assert.doesNotMatch(dashboardFormSource, /onClick=\{handleAIPreview\}/)
})
