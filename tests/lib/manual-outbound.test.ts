import test from "node:test"
import assert from "node:assert/strict"

async function loadModule() {
  return import(new URL("../../lib/manual-outbound.ts", import.meta.url).href)
}

test("external email recipients can only use the email channel", async () => {
  const { manualOutboundSchema } = await loadModule()

  assert.throws(() =>
    manualOutboundSchema.parse({
      channel: "both",
      recipientType: "external-email",
      email: "ops@example.com",
      template: "custom",
      subject: "Hello",
      emailText: "hello",
      emailHtml: "<p>hello</p>",
    }),
  )
})

test("invite-code-resend requires a manually entered invite code", async () => {
  const { manualOutboundSchema } = await loadModule()

  assert.throws(() =>
    manualOutboundSchema.parse({
      channel: "email",
      recipientType: "external-email",
      email: "ops@example.com",
      template: "invite-code-resend",
      subject: "Invite",
      emailText: "invite",
      emailHtml: "<p>invite</p>",
    }),
  )
})

test("manual notice drafts can prefill email and message content", async () => {
  const { buildManualOutboundDraft } = await loadModule()

  const draft = buildManualOutboundDraft({
    template: "manual-notice",
    locale: "zh",
    appName: "Precheck",
    issuerName: "Root Admin",
    subject: "人工通知",
    note: "请明天前完成确认",
  })

  assert.match(draft.emailText, /请明天前完成确认/)
  assert.match(draft.emailHtml, /人工通知/)
  assert.match(draft.messageContent, /请明天前完成确认/)
})
