import { z } from "zod"

export const manualOutboundChannels = ["email", "message", "both"] as const
export const manualOutboundRecipientTypes = ["system-user", "external-email"] as const
export const manualOutboundTemplates = ["custom", "invite-code-resend", "manual-notice"] as const

export const manualOutboundSchema = z
  .object({
    channel: z.enum(manualOutboundChannels),
    recipientType: z.enum(manualOutboundRecipientTypes),
    userId: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    template: z.enum(manualOutboundTemplates),
    subject: z.string().trim().min(1).max(200),
    messageContent: z.string().optional(),
    emailText: z.string().optional(),
    emailHtml: z.string().optional(),
    inviteCode: z.string().trim().optional(),
    note: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recipientType === "system-user" && !value.userId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "userId is required" })
    }
    if (value.recipientType === "external-email" && value.channel !== "email") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "external email only supports email",
      })
    }
    if (value.recipientType === "external-email" && !value.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "email is required" })
    }
    if (value.template === "invite-code-resend" && !value.inviteCode?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invite code is required" })
    }
  })

type BuildManualOutboundDraftInput = {
  template: (typeof manualOutboundTemplates)[number]
  locale: string
  appName: string
  issuerName: string
  subject: string
  note?: string
  inviteCode?: string
}

type ManualOutboundDraft = {
  subject: string
  messageContent: string
  emailText: string
  emailHtml: string
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildManualNoticeDraft({
  locale,
  appName,
  subject,
  issuerName,
  note,
}: BuildManualOutboundDraftInput): ManualOutboundDraft {
  const normalizedSubject = subject.trim() || (locale === "zh" ? "人工通知" : "Manual Notice")
  const intro =
    locale === "zh"
      ? "管理员向你发送了一条人工通知，请查看以下内容。"
      : "An administrator sent you a manual notice. Please review the details below."
  const issuerLine = locale === "zh" ? `发送人：${issuerName}` : `Sender: ${issuerName}`
  const footer =
    locale === "zh" ? "如有疑问，请联系管理员。" : "If you have questions, please contact an admin."
  const normalizedNote = note?.trim() || ""
  const emailText = [
    normalizedSubject,
    "",
    intro,
    "",
    normalizedNote,
    "",
    issuerLine,
    "",
    footer,
  ].join("\n")

  return {
    subject: normalizedSubject,
    messageContent: [normalizedSubject, normalizedNote].filter(Boolean).join("\n\n"),
    emailText,
    emailHtml: `<!doctype html><html><body><h1>${escapeHtml(normalizedSubject)}</h1><p>${escapeHtml(
      intro,
    )}</p><p>${escapeHtml(normalizedNote)}</p><p>${escapeHtml(issuerLine)}</p><p>${escapeHtml(
      footer,
    )}</p><footer>${escapeHtml(appName)}</footer></body></html>`,
  }
}

function buildFallbackInviteCodeDraft({
  locale,
  subject,
  issuerName,
  inviteCode,
  note,
}: BuildManualOutboundDraftInput): ManualOutboundDraft {
  const normalizedSubject =
    subject.trim() || (locale === "zh" ? "邀请码补发" : "Invite Code Resend")
  const body = [
    locale === "zh"
      ? "管理员为你补发了一份邀请码。"
      : "An administrator resent an invite code for you.",
    locale === "zh" ? `发送人：${issuerName}` : `Sender: ${issuerName}`,
    locale === "zh" ? `邀请码：${inviteCode ?? ""}` : `Invite code: ${inviteCode ?? ""}`,
    ...(note?.trim() ? [locale === "zh" ? `备注：${note.trim()}` : `Note: ${note.trim()}`] : []),
  ].join("\n\n")

  return {
    subject: normalizedSubject,
    messageContent: body,
    emailText: body,
    emailHtml: `<p>${body.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br />")}</p>`,
  }
}

export function buildManualOutboundDraft(
  input: BuildManualOutboundDraftInput,
): ManualOutboundDraft {
  if (input.template === "manual-notice") {
    return buildManualNoticeDraft(input)
  }

  if (input.template === "invite-code-resend") {
    return buildFallbackInviteCodeDraft(input)
  }

  return {
    subject: input.subject.trim(),
    messageContent: input.note?.trim() || "",
    emailText: input.note?.trim() || "",
    emailHtml: `<p>${(input.note?.trim() || "").replace(/\n/g, "<br />")}</p>`,
  }
}
