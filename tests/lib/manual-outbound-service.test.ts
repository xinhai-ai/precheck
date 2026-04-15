import test from "node:test"
import assert from "node:assert/strict"

async function loadModule() {
  return import(new URL("../../lib/manual-outbound-service.ts", import.meta.url).href)
}

test("both mode keeps the in-app message when email sending fails", async () => {
  const { sendManualOutbound } = await loadModule()

  const calls: string[] = []

  const result = await sendManualOutbound(
    {
      getUserById: async () => ({ id: "u1", email: "user@example.com", name: "U1" }),
      createMessage: async () => {
        calls.push("message")
        return { id: "msg_1" }
      },
      sendEmail: async () => {
        calls.push("email")
        throw new Error("smtp down")
      },
      writeAuditLog: async () => null,
    },
    {
      actor: { id: "sa_1", email: "root@example.com", role: "SUPER_ADMIN" },
      payload: {
        channel: "both",
        recipientType: "system-user",
        userId: "u1",
        template: "custom",
        subject: "hello",
        messageContent: "<p>hello</p>",
        emailText: "hello",
        emailHtml: "<p>hello</p>",
      },
    },
  )

  assert.deepEqual(calls, ["message", "email"])
  assert.equal(result.status, "partial")
  assert.equal(result.messageId, "msg_1")
  assert.equal(result.email.ok, false)
})

test("both mode rejects system users without an email address", async () => {
  const { sendManualOutbound } = await loadModule()

  await assert.rejects(() =>
    sendManualOutbound(
      {
        getUserById: async () => ({ id: "u1", email: null, name: "U1" }),
        createMessage: async () => ({ id: "msg_1" }),
        sendEmail: async () => undefined,
        writeAuditLog: async () => null,
      },
      {
        actor: { id: "sa_1", email: "root@example.com", role: "SUPER_ADMIN" },
        payload: {
          channel: "both",
          recipientType: "system-user",
          userId: "u1",
          template: "custom",
          subject: "hello",
          messageContent: "<p>hello</p>",
          emailText: "hello",
          emailHtml: "<p>hello</p>",
        },
      },
    ),
  )
})

test("external email batches are sent one by one and keep partial delivery details", async () => {
  const { sendManualOutbound } = await loadModule()

  const sent: string[] = []

  const result = await sendManualOutbound(
    {
      getUserById: async () => null,
      createMessage: async () => {
        throw new Error("message should not be created for external email batches")
      },
      sendEmail: async ({ to }: { to: string }) => {
        sent.push(to)
        if (to === "beta@example.com") {
          throw new Error("smtp down")
        }
      },
      writeAuditLog: async () => null,
    },
    {
      actor: { id: "sa_1", email: "root@example.com", role: "SUPER_ADMIN" },
      payload: {
        channel: "email",
        recipientType: "external-email",
        emails: ["alpha@example.com", "beta@example.com", "gamma@example.com"],
        template: "custom",
        subject: "hello",
        emailText: "hello",
        emailHtml: "<p>hello</p>",
      },
    },
  )

  assert.deepEqual(sent, ["alpha@example.com", "beta@example.com", "gamma@example.com"])
  assert.equal(result.status, "partial")
  assert.equal(result.email.ok, false)
  assert.equal(result.email.sentCount, 2)
  assert.equal(result.email.failedCount, 1)
  assert.deepEqual(result.email.deliveries, [
    { ok: true, to: "alpha@example.com" },
    { ok: false, to: "beta@example.com", error: "smtp down" },
    { ok: true, to: "gamma@example.com" },
  ])
})
