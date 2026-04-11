import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const routeUrl = new URL(
  "../../../app/api/admin/pre-applications/[id]/revoke-approval/route.ts",
  import.meta.url,
)
const routeSource = existsSync(routeUrl) ? readFileSync(routeUrl, "utf8") : ""
const templateSource = readFileSync(
  new URL("../../../lib/email/templates.ts", import.meta.url),
  "utf8",
)
const errorKeysSource = readFileSync(
  new URL("../../../lib/api/error-keys.ts", import.meta.url),
  "utf8",
)
const openApiSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const zhSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("approval revoke route exists", () => {
  assert.equal(existsSync(routeUrl), true)
})

test("approval revoke route enforces super-admin checks and protected state guards", () => {
  assert.match(routeSource, /isSuperAdmin/)
  assert.match(routeSource, /PreApplicationStatus\.APPROVED/)
  assert.match(routeSource, /formalApplicationApprovedFeedbackAt/)
  assert.match(routeSource, /usedAt/)
  assert.match(routeSource, /inviteCode:\s*\{\s*disconnect:\s*true\s*\}/)
  assert.match(routeSource, /codeSent:\s*false/)
  assert.match(routeSource, /codeSentAt:\s*null/)
  assert.match(routeSource, /PRE_APPLICATION_REVIEW_REVOKE_APPROVAL/)
  assert.match(routeSource, /INVITE_CODE_UNASSIGN/)
})

test("approval revoke route sends revoke email and returns email result fields", () => {
  assert.match(routeSource, /buildPreApplicationApprovalRevokedEmail/)
  assert.match(routeSource, /sendEmail/)
  assert.match(routeSource, /emailSent/)
  assert.match(routeSource, /emailError/)
})

test("approval revoke email builder exists", () => {
  assert.match(templateSource, /buildPreApplicationApprovalRevokedEmail/)
})

test("approval revoke error keys exist", () => {
  assert.match(errorKeysSource, /approvalRevokeFailed/)
  assert.match(errorKeysSource, /approvalNotRevocable/)
  assert.match(errorKeysSource, /approvalRevokeInviteAlreadyUsed/)
  assert.match(errorKeysSource, /approvalRevokeFormalFeedbackExists/)
})

test("approval revoke OpenAPI path exists", () => {
  assert.match(openApiSource, /"\/admin\/pre-applications\/\{id\}\/revoke-approval"/)
  assert.match(openApiSource, /summary:\s*"撤回已通过预申请"/)
  assert.match(openApiSource, /required:\s*\["reason"\]/)
})

test("approval revoke email and api-error dictionaries exist in both locales", () => {
  for (const source of [zhSource, enSource]) {
    assert.match(source, /"approvalRevokedEmailTemplate"\s*:\s*\{[\s\S]*?"subject"\s*:/)
    assert.match(source, /"approvalRevokeFailed"\s*:/)
    assert.match(source, /"approvalNotRevocable"\s*:/)
    assert.match(source, /"approvalRevokeInviteAlreadyUsed"\s*:/)
    assert.match(source, /"approvalRevokeFormalFeedbackExists"\s*:/)
  }
})
