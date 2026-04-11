import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const tableSource = readFileSync(
  new URL("../../../components/admin/pre-applications-table.tsx", import.meta.url),
  "utf8",
)
const zhSource = readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8")
const enSource = readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8")

test("admin pre-application table exposes a super-admin-only revoke action for approved records", () => {
  assert.match(tableSource, /selected\?\.status === "APPROVED"/)
  assert.match(tableSource, /isSuperAdmin/)
  assert.match(tableSource, /preApplicationRevokeApprovalAction/)
  assert.match(tableSource, /\/api\/admin\/pre-applications\/\$\{selected\.id\}\/revoke-approval/)
})

test("admin pre-application table validates revoke reason and handles revoke email warnings", () => {
  assert.match(tableSource, /preApplicationRevokeApprovalReasonRequired/)
  assert.match(tableSource, /preApplicationRevokeApprovalFailed/)
  assert.match(tableSource, /preApplicationRevokeApprovalSuccess/)
  assert.match(tableSource, /emailError/)
})

test("revoke approval dialog dictionary keys exist in both locales", () => {
  for (const source of [zhSource, enSource]) {
    assert.match(source, /"preApplicationRevokeApprovalAction"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalTitle"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalDescription"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalReasonLabel"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalReasonPlaceholder"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalReasonRequired"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalSubmitting"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalSuccess"\s*:/)
    assert.match(source, /"preApplicationRevokeApprovalFailed"\s*:/)
  }
})
