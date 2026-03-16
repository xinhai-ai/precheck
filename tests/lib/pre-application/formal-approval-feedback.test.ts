import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const schemaSource = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8")
const userRouteSource = readFileSync(
  new URL("../../../app/api/pre-application/route.ts", import.meta.url),
  "utf8",
)
const adminListRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/route.ts", import.meta.url),
  "utf8",
)
const exportRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-applications/export/route.ts", import.meta.url),
  "utf8",
)
const mutationRoutePath = new URL(
  "../../../app/api/pre-application/formal-application-feedback/route.ts",
  import.meta.url,
)
const errorKeysSource = readFileSync(new URL("../../../lib/api/error-keys.ts", import.meta.url), "utf8")
const openApiSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const dashboardFormSource = readFileSync(
  new URL("../../../components/dashboard/pre-application-form.tsx", import.meta.url),
  "utf8",
)
const zhDictSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")
const adminTableSource = readFileSync(
  new URL("../../../components/admin/pre-applications-table.tsx", import.meta.url),
  "utf8",
)

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

test("pre-application schema includes formal approval feedback timestamp", () => {
  assert.match(schemaSource, /formalApplicationApprovedFeedbackAt\s+DateTime\?/)
  assert.match(schemaSource, /@@index\(\[status, formalApplicationApprovedFeedbackAt\]\)/)
})

test("user and admin read models expose the feedback timestamp", () => {
  assert.match(userRouteSource, /formalApplicationApprovedFeedbackAt:\s*true/)
  assert.match(adminListRouteSource, /formalApplicationApprovedFeedbackAt:\s*true/)
  assert.match(exportRouteSource, /formalApplicationApprovedFeedbackAt/)
})

test("formal approval feedback route enforces auth, approved status, audit log, and idempotency", () => {
  assert.equal(existsSync(mutationRoutePath), true)
  const mutationRouteSource = readIfExists(mutationRoutePath)

  assert.match(mutationRouteSource, /export async function POST/)
  assert.match(mutationRouteSource, /getCurrentUserFromRequest/)
  assert.match(mutationRouteSource, /status:\s*PreApplicationStatus\.APPROVED/)
  assert.match(mutationRouteSource, /formalApplicationApprovedFeedbackAt:\s*now/)
  assert.match(mutationRouteSource, /if \(latest\.formalApplicationApprovedFeedbackAt\)/)
  assert.match(mutationRouteSource, /writeAuditLog\(/)
})

test("error keys and openapi document the feedback route", () => {
  assert.match(errorKeysSource, /formalApprovalFeedback:/)
  assert.match(errorKeysSource, /notAllowed:/)
  assert.match(errorKeysSource, /failedToSubmit:/)
  assert.match(openApiSource, /"\/pre-application\/formal-application-feedback"/)
})

test("dashboard pre-application form implements two-click formal approval feedback", () => {
  assert.match(dashboardFormSource, /formalApplicationApprovedFeedbackAt:\s*string \| null/)
  assert.match(dashboardFormSource, /formalApprovalFeedbackConfirming/)
  assert.match(dashboardFormSource, /formalApprovalFeedbackSubmitting/)
  assert.match(dashboardFormSource, /我已经通过L站正式申请/)
  assert.match(dashboardFormSource, /我确认我已经通过/)
  assert.match(dashboardFormSource, /\/api\/pre-application\/formal-application-feedback/)
  assert.match(dashboardFormSource, /感谢您的反馈，这对我们改善审核机制非常重要。/)
})

test("dictionaries include formal approval feedback copy", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"formalApprovalFeedbackButton"\s*:/)
    assert.match(source, /"formalApprovalFeedbackConfirmButton"\s*:/)
    assert.match(source, /"formalApprovalFeedbackHint"\s*:/)
    assert.match(source, /"formalApprovalFeedbackThanks"\s*:/)
    assert.match(source, /"formalApprovalFeedbackSuccess"\s*:/)
  }
})

test("admin pre-application table exposes formal feedback status column and filter", () => {
  assert.match(adminTableSource, /formalApplicationApprovedFeedbackAt:\s*string \| null/)
  assert.match(adminTableSource, /formalFeedbackStatusFilter/)
  assert.match(adminTableSource, /formalFeedbackStatus/)
  assert.match(adminTableSource, /正式申请反馈|Formal Application Feedback/)
  assert.match(adminTableSource, /已反馈|Confirmed/)
  assert.match(adminTableSource, /未反馈|Unconfirmed/)
  assert.match(adminTableSource, /formalFeedbackStatus=|formalFeedbackStatus:/)
})

test("admin routes and openapi support formal feedback filtering and export", () => {
  assert.match(adminListRouteSource, /formalFeedbackStatus/)
  assert.match(adminListRouteSource, /formalApplicationApprovedFeedbackAt:\s*\{\s*not:\s*null\s*\}/)
  assert.match(adminListRouteSource, /formalApplicationApprovedFeedbackAt:\s*null/)
  assert.match(exportRouteSource, /formalFeedbackStatus/)
  assert.match(openApiSource, /formalApplicationApprovedFeedbackAt/)
})
