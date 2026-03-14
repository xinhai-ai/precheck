import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const reviewRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/[id]/review/route.ts", import.meta.url),
  "utf8",
)
const listRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/route.ts", import.meta.url),
  "utf8",
)
const componentSource = readFileSync(
  new URL("../../../components/admin/pre-application-appeals-table.tsx", import.meta.url),
  "utf8",
)
const openApiSpecSource = readFileSync(
  new URL("../../../lib/openapi-spec.ts", import.meta.url),
  "utf8",
)
const zhDictionary = JSON.parse(
  readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8"),
) as Record<string, any>
const enDictionary = JSON.parse(
  readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8"),
) as Record<string, any>

test("appeal approve route accepts guidance, inviteCode, and codeSent", () => {
  assert.match(reviewRouteSource, /guidance:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2000\)/)
  assert.match(reviewRouteSource, /inviteCode:\s*z\.string\(\)\.trim\(\)\.optional\(\)/)
  assert.match(reviewRouteSource, /codeSent:\s*z\.boolean\(\)\.optional\(\)/)
  assert.match(reviewRouteSource, /const rawGuidance =/)
  assert.match(reviewRouteSource, /const guidanceWithCode =/)
  assert.match(reviewRouteSource, /reviewComment:\s*rawGuidance|reviewComment:\s*guidance/)
  assert.match(reviewRouteSource, /guidance:\s*guidanceWithCode/)
  assert.match(reviewRouteSource, /codeSentAt:\s*now|codeSentAt:\s*new Date\(\)/)
  assert.match(reviewRouteSource, /metadata:\s*\{[\s\S]*inviteCode[\s\S]*codeSent/)
})

test("appeal list route exposes approved pre-application invite status fields", () => {
  assert.match(listRouteSource, /codeSent:\s*true/)
  assert.match(listRouteSource, /codeSentAt:\s*true/)
  assert.match(listRouteSource, /inviteCode:\s*\{/)
})

test("appeal approve dialog reuses invite code and code-sent controls", () => {
  assert.match(componentSource, /const \[guidance, setGuidance\] = useState\(""\)/)
  assert.match(componentSource, /const \[inviteCode, setInviteCode\] = useState\(""\)/)
  assert.match(componentSource, /const \[markCodeSent, setMarkCodeSent\] = useState\(false\)/)
  assert.match(componentSource, /const \[inviteCodeCheckResult, setInviteCodeCheckResult\]/)
  assert.match(componentSource, /extractPureCode/)
  assert.match(componentSource, /guidance,/)
  assert.match(componentSource, /inviteCode:\s*inviteCode\.trim\(\) \|\| undefined/)
  assert.match(componentSource, /codeSent:\s*!!inviteCode\.trim\(\) \|\| markCodeSent/)
})

test("appeal view mode shows approved guidance and invite status", () => {
  assert.match(componentSource, /reviewDialog\.appeal\.preApplication\.codeSent/)
  assert.match(componentSource, /reviewDialog\.appeal\.preApplication\.inviteCode/)
  assert.match(componentSource, /reviewDialog\.appeal\.preApplication\.guidance/)
  assert.match(componentSource, /inviteStatusIssued|inviteStatusNone/)
})

test("openapi and appeal page copy describe the aligned approve flow", () => {
  assert.match(openApiSpecSource, /guidance: \{ type: "string", minLength: 1, maxLength: 2000 \}/)
  assert.match(openApiSpecSource, /inviteCode: \{ type: "string" \}/)
  assert.match(openApiSpecSource, /codeSent: \{ type: "boolean" \}/)
  assert.equal(
    zhDictionary.admin.preApplicationAppealsPage.dialog.overrideDescription,
    "填写指导意见后将直接通过该预申请，不再回到待审核列表。",
  )
  assert.equal(
    enDictionary.admin.preApplicationAppealsPage.dialog.overrideDescription,
    "Add guidance before approving this pre-application directly from the appeal queue.",
  )
  assert.equal(
    zhDictionary.admin.preApplicationAppealsPage.messages.commentRequired,
    "请输入指导意见",
  )
  assert.equal(
    enDictionary.admin.preApplicationAppealsPage.messages.commentRequired,
    "Guidance is required",
  )
})
