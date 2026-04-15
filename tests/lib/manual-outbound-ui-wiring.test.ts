import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const pagePath = new URL("../../app/[locale]/admin/manual-outbound/page.tsx", import.meta.url)
const formPath = new URL("../../components/admin/manual-outbound-form.tsx", import.meta.url)
const pageSource = existsSync(pagePath) ? readFileSync(pagePath, "utf8") : ""
const formSource = existsSync(formPath) ? readFileSync(formPath, "utf8") : ""
const sidebarSource = readFileSync(
  new URL("../../components/admin/sidebar.tsx", import.meta.url),
  "utf8",
)
const zh = readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8")
const en = readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8")

test("manual outbound page is mounted in admin ui with localized copy", () => {
  assert.match(pageSource, /AdminManualOutboundForm/)
  assert.match(formSource, /\/api\/admin\/users\?/)
  assert.match(formSource, /\/api\/admin\/manual-outbound/)
  assert.match(formSource, /splitManualOutboundRecipientEmails/)
  assert.match(formSource, /RichTextEditor/)
  assert.match(sidebarSource, /\/admin\/manual-outbound/)
  assert.match(sidebarSource, /superAdminOnly:\s*true/)
  assert.match(zh, /"manualOutboundExternalEmailBatchHint":\s*"每行填写一个邮箱，发送时会逐个单独发送。"/)
  assert.match(en, /"manualOutboundExternalEmailBatchHint":\s*"Enter one email per line, and each email will be sent separately\."/)
  assert.match(zh, /"manualOutbound":\s*"手动发信"/)
  assert.match(en, /"manualOutbound":\s*"Manual Outbound"/)
})
