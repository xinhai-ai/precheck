type ManualOutboundActor = {
  id: string
  email: string
  role: string
}

type ManualOutboundPayload = {
  channel: "email" | "message" | "both"
  recipientType: "system-user" | "external-email"
  userId?: string
  email?: string
  emails?: string[]
  template: "custom" | "invite-code-resend" | "manual-notice"
  subject: string
  messageContent?: string
  emailText?: string
  emailHtml?: string
}

type ManualOutboundServiceInput = {
  actor: ManualOutboundActor
  payload: ManualOutboundPayload
}

type ManualOutboundUser = {
  id: string
  email: string | null
  name: string | null
}

type ManualOutboundDeps = {
  getUserById: (userId: string) => Promise<ManualOutboundUser | null>
  createMessage: (input: {
    title: string
    content: string
    recipientUserId: string
    actorId: string
  }) => Promise<{ id: string }>
  sendEmail: (input: { to: string; subject: string; text: string; html?: string }) => Promise<void>
  writeAuditLog: (input: Record<string, unknown>) => Promise<unknown>
}

type ManualOutboundEmailDelivery = {
  ok: boolean
  to: string
  error?: string
}

type ManualOutboundResult = {
  status: "success" | "partial"
  messageId?: string
  message: { ok: boolean; skipped?: boolean }
  email: {
    ok: boolean
    skipped?: boolean
    error?: string
    to?: string
    deliveries?: ManualOutboundEmailDelivery[]
    sentCount?: number
    failedCount?: number
  }
}

function normalizeManualOutboundRecipientEmails(input: {
  email?: string
  emails?: string[]
}) {
  return Array.from(
    new Set([
      ...(input.email?.trim() ? [input.email.trim()] : []),
      ...((input.emails ?? []).map((item) => item.trim()).filter(Boolean)),
    ]),
  )
}

export async function sendManualOutbound(
  deps: ManualOutboundDeps,
  input: ManualOutboundServiceInput,
): Promise<ManualOutboundResult> {
  const { payload, actor } = input
  const needsMessage = payload.channel === "message" || payload.channel === "both"
  const needsEmail = payload.channel === "email" || payload.channel === "both"

  const recipient =
    payload.recipientType === "system-user" && payload.userId
      ? await deps.getUserById(payload.userId)
      : null

  if (payload.recipientType === "system-user" && !recipient) {
    throw new Error("Recipient user not found")
  }

  if (payload.channel === "both" && payload.recipientType === "system-user" && !recipient?.email) {
    throw new Error("Recipient user does not have an email address")
  }

  let messageId: string | undefined
  if (needsMessage) {
    const message = await deps.createMessage({
      title: payload.subject,
      content: payload.messageContent || "",
      recipientUserId: recipient!.id,
      actorId: actor.id,
    })
    messageId = message.id
  }

  const result: ManualOutboundResult = {
    status: "success",
    messageId,
    message: needsMessage ? { ok: true } : { ok: false, skipped: true },
    email: needsEmail ? { ok: true } : { ok: false, skipped: true },
  }

  if (needsEmail) {
    const recipients =
      payload.recipientType === "external-email"
        ? normalizeManualOutboundRecipientEmails(payload)
        : recipient?.email
          ? [recipient.email]
          : []

    if (recipients.length === 0) {
      throw new Error("Email recipient is required")
    }

    const deliveries: ManualOutboundEmailDelivery[] = []

    for (const to of recipients) {
      try {
        await deps.sendEmail({
          to,
          subject: payload.subject,
          text: payload.emailText || "",
          html: payload.emailHtml,
        })
        deliveries.push({ ok: true, to })
      } catch (error) {
        deliveries.push({
          ok: false,
          to,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const sentCount = deliveries.filter((delivery) => delivery.ok).length
    const failedDeliveries = deliveries.filter((delivery) => !delivery.ok)
    const failedCount = failedDeliveries.length
    const firstFailure = failedDeliveries[0]

    if (failedCount === 0) {
      result.email =
        deliveries.length === 1
          ? { ok: true, to: deliveries[0]!.to }
          : {
              ok: true,
              deliveries,
              sentCount,
              failedCount,
            }
    } else if (sentCount > 0 || (payload.channel === "both" && messageId)) {
      result.status = "partial"
      result.email = {
        ok: false,
        ...(deliveries.length === 1 ? { to: deliveries[0]!.to, error: firstFailure?.error } : {}),
        ...(deliveries.length > 1 ? { deliveries, sentCount, failedCount } : {}),
      }
    } else {
      throw new Error(firstFailure?.error || "Failed to send email")
    }
  }

  await deps.writeAuditLog({
    action: "MANUAL_OUTBOUND_SEND",
    entityType: "MANUAL_OUTBOUND",
    entityId: messageId ?? null,
    actor,
    metadata: {
      channel: payload.channel,
      recipientType: payload.recipientType,
      template: payload.template,
      targetUserId: recipient?.id ?? null,
      targetEmail:
        payload.recipientType === "external-email"
          ? (payload.email ?? null)
          : (recipient?.email ?? null),
      resultStatus: result.status,
      email: result.email,
    },
  })

  return result
}
