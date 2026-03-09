import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const emailTemplatesSource = readFileSync(new URL("../../lib/email/templates.ts", import.meta.url), "utf8")
const accountReactivationSource = readFileSync(
  new URL("../../lib/email/templates/account-reactivation.ts", import.meta.url),
  "utf8",
)

const noReplyNote = "本邮件为系统自动发送邮件，请勿直接回复"

test("shared email templates define and append the no-reply note", () => {
  assert.match(emailTemplatesSource, new RegExp(noReplyNote))
  assert.match(emailTemplatesSource, /wrapEmailHtml\(/)
})

test("account reactivation template defines and appends the no-reply note", () => {
  assert.match(accountReactivationSource, new RegExp(noReplyNote))
  assert.match(accountReactivationSource, /wrapEmailHtml\(/)
})
