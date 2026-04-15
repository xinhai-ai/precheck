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

test("external email recipients can be normalized from one-per-line input", async () => {
  const { manualOutboundSchema, splitManualOutboundRecipientEmails } = await loadModule()

  const emails = splitManualOutboundRecipientEmails(`
    alpha@example.com

    beta@example.com
    alpha@example.com
  `)

  assert.deepEqual(emails, ["alpha@example.com", "beta@example.com"])

  const payload = manualOutboundSchema.parse({
    channel: "email",
    recipientType: "external-email",
    emails,
    template: "custom",
    subject: "Hello",
    emailText: "hello",
    emailHtml: "<p>hello</p>",
  })

  assert.deepEqual(payload.emails, ["alpha@example.com", "beta@example.com"])
})

test("external email recipients require at least one isolated address", async () => {
  const { manualOutboundSchema } = await loadModule()

  assert.throws(() =>
    manualOutboundSchema.parse({
      channel: "email",
      recipientType: "external-email",
      emails: [],
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
