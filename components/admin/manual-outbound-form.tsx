"use client"

import { useState } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Search, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/posts/rich-text-editor"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import {
  buildManualOutboundDraft,
  manualOutboundSchema,
  manualOutboundTemplates,
} from "@/lib/manual-outbound"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"

interface AdminManualOutboundFormProps {
  locale: Locale
  dict: Dictionary
}

type ManualOutboundTemplate = (typeof manualOutboundTemplates)[number]

type AdminUserItem = {
  id: string
  name: string | null
  email: string
  role: string
  status: string
}

type FormState = {
  channel: "email" | "message" | "both"
  recipientType: "system-user" | "external-email"
  userId: string
  email: string
  template: ManualOutboundTemplate
  subject: string
  messageContent: string
  emailText: string
  emailHtml: string
  inviteCode: string
  note: string
}

const initialState: FormState = {
  channel: "email",
  recipientType: "system-user",
  userId: "",
  email: "",
  template: "custom",
  subject: "",
  messageContent: "",
  emailText: "",
  emailHtml: "",
  inviteCode: "",
  note: "",
}

export function AdminManualOutboundForm({ locale, dict }: AdminManualOutboundFormProps) {
  const t = dict.admin
  const appName = dict.metadata?.title || "App"
  const [formData, setFormData] = useState<FormState>(initialState)
  const [userSearch, setUserSearch] = useState("")
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")

  const needsEmail = formData.recipientType === "external-email" || formData.channel !== "message"
  const needsMessage = formData.recipientType === "system-user" && formData.channel !== "email"

  const applyTemplateDraft = (nextTemplate?: ManualOutboundTemplate) => {
    const template = nextTemplate ?? formData.template
    if (template === "custom") return

    const draft = buildManualOutboundDraft({
      template,
      locale,
      appName,
      issuerName: dict.admin.title,
      subject:
        formData.subject.trim() ||
        (template === "invite-code-resend"
          ? t.manualOutboundTemplateInviteCodeResend
          : t.manualOutboundTemplateManualNotice),
      note: formData.note,
      inviteCode: formData.inviteCode,
    })

    setFormData((prev) => ({
      ...prev,
      template,
      subject: draft.subject,
      messageContent: draft.messageContent,
      emailText: draft.emailText,
      emailHtml: draft.emailHtml,
    }))
  }

  const searchUsers = async () => {
    if (formData.recipientType !== "system-user") return
    setSearchingUsers(true)
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "10",
        ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
      })
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) {
        throw new Error(t.manualOutboundLoadUsersFailed)
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.manualOutboundLoadUsersFailed)
    } finally {
      setSearchingUsers(false)
    }
  }

  const handleRecipientTypeChange = (value: "system-user" | "external-email") => {
    setFormError("")
    setUsers([])
    setSelectedUser(null)
    setFormData((prev) => ({
      ...prev,
      recipientType: value,
      channel: value === "external-email" ? "email" : prev.channel,
      userId: "",
      email: value === "system-user" ? "" : prev.email,
    }))
  }

  const handleTemplateChange = (value: ManualOutboundTemplate) => {
    setFormData((prev) => ({ ...prev, template: value }))
    if (value !== "custom") {
      setTimeout(() => applyTemplateDraft(value), 0)
    }
  }

  const handleSubmit = async () => {
    setFormError("")

    try {
      const payload = manualOutboundSchema.parse({
        channel: formData.recipientType === "external-email" ? "email" : formData.channel,
        recipientType: formData.recipientType,
        userId: formData.recipientType === "system-user" ? formData.userId || undefined : undefined,
        email:
          formData.recipientType === "external-email"
            ? formData.email.trim() || undefined
            : undefined,
        template: formData.template,
        subject: formData.subject.trim(),
        messageContent: needsMessage ? formData.messageContent : undefined,
        emailText: needsEmail ? formData.emailText : undefined,
        emailHtml: needsEmail ? formData.emailHtml : undefined,
        inviteCode: formData.template === "invite-code-resend" ? formData.inviteCode : undefined,
        note: formData.note || undefined,
      })

      setSubmitting(true)
      const res = await fetch("/api/admin/manual-outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(resolveApiErrorMessage(data, dict) ?? t.manualOutboundSendFailed)
      }

      if (data?.status === "partial") {
        toast.success(t.manualOutboundSendPartial)
      } else {
        toast.success(t.manualOutboundSendSuccess)
        setFormData({
          ...initialState,
          recipientType: formData.recipientType,
          channel: formData.recipientType === "external-email" ? "email" : initialState.channel,
        })
        setUserSearch("")
        setUsers([])
        setSelectedUser(null)
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setFormError(error.errors[0]?.message ?? t.manualOutboundSendFailed)
      } else {
        setFormError(error instanceof Error ? error.message : t.manualOutboundSendFailed)
      }
      toast.error(error instanceof Error ? error.message : t.manualOutboundSendFailed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>{t.manualOutbound}</CardTitle>
          <CardDescription>{t.manualOutboundDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {formError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.manualOutboundRecipientTypeLabel}</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(value) =>
                  handleRecipientTypeChange(value as "system-user" | "external-email")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system-user">{t.manualOutboundRecipientSystemUser}</SelectItem>
                  <SelectItem value="external-email">
                    {t.manualOutboundRecipientExternalEmail}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.manualOutboundChannelLabel}</Label>
              <Select
                value={formData.recipientType === "external-email" ? "email" : formData.channel}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    channel: value as "email" | "message" | "both",
                  }))
                }
                disabled={formData.recipientType === "external-email"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">{t.emailLogs}</SelectItem>
                  <SelectItem value="message">{t.messages}</SelectItem>
                  <SelectItem value="both">{t.manualOutboundChannelBoth}</SelectItem>
                </SelectContent>
              </Select>
              {formData.recipientType === "external-email" ? (
                <p className="text-xs text-muted-foreground">{t.manualOutboundExternalEmailHint}</p>
              ) : null}
            </div>
          </div>

          {formData.recipientType === "system-user" ? (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{t.manualOutboundSelectUser}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder={t.manualOutboundUserSearchPlaceholder}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={searchUsers}
                    disabled={searchingUsers}
                  >
                    {searchingUsers ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">{t.manualOutboundSearchUsers}</span>
                  </Button>
                </div>
              </div>

              {selectedUser ? (
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <p className="font-medium">{t.manualOutboundSelectedUser}</p>
                  <p>{selectedUser.name || "-"}</p>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser.role} / {selectedUser.status}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.manualOutboundNoUsers}</p>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full rounded-lg border bg-background px-3 py-3 text-left transition hover:border-primary/50"
                      onClick={() => {
                        setSelectedUser(user)
                        setFormData((prev) => ({ ...prev, userId: user.id }))
                      }}
                    >
                      <p className="font-medium">{user.name || "-"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.role} / {user.status}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manual-outbound-email">{t.manualOutboundTargetEmailLabel}</Label>
              <Input
                id="manual-outbound-email"
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder={t.manualOutboundTargetEmailPlaceholder}
              />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="space-y-2">
              <Label>{t.manualOutboundTemplateLabel}</Label>
              <Select
                value={formData.template}
                onValueChange={(value) => handleTemplateChange(value as ManualOutboundTemplate)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">{t.manualOutboundTemplateCustom}</SelectItem>
                  <SelectItem value="invite-code-resend">
                    {t.manualOutboundTemplateInviteCodeResend}
                  </SelectItem>
                  <SelectItem value="manual-notice">
                    {t.manualOutboundTemplateManualNotice}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.template !== "custom" ? (
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={() => applyTemplateDraft()}>
                  {t.manualOutboundApplyTemplate}
                </Button>
              </div>
            ) : null}
          </div>

          {formData.template === "invite-code-resend" ? (
            <div className="space-y-2">
              <Label htmlFor="manual-outbound-invite-code">{t.manualOutboundInviteCodeLabel}</Label>
              <Input
                id="manual-outbound-invite-code"
                value={formData.inviteCode}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, inviteCode: event.target.value }))
                }
                placeholder={t.manualOutboundInviteCodePlaceholder}
              />
            </div>
          ) : null}

          {formData.template !== "custom" ? (
            <div className="space-y-2">
              <Label htmlFor="manual-outbound-note">{t.manualOutboundNoteLabel}</Label>
              <Textarea
                id="manual-outbound-note"
                value={formData.note}
                onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
                placeholder={t.manualOutboundNotePlaceholder}
                rows={4}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="manual-outbound-subject">{t.manualOutboundSubjectLabel}</Label>
            <Input
              id="manual-outbound-subject"
              value={formData.subject}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder={t.manualOutboundSubjectPlaceholder}
            />
          </div>

          {needsMessage ? (
            <div className="space-y-2">
              <Label>{t.manualOutboundMessageContentLabel}</Label>
              <RichTextEditor
                value={formData.messageContent}
                onChange={(content) =>
                  setFormData((prev) => ({ ...prev, messageContent: content }))
                }
                placeholder={t.messageContentPlaceholder}
                className="min-h-[220px]"
              />
            </div>
          ) : null}

          {needsEmail ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-outbound-email-text">{t.manualOutboundEmailTextLabel}</Label>
                <Textarea
                  id="manual-outbound-email-text"
                  value={formData.emailText}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, emailText: event.target.value }))
                  }
                  rows={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-outbound-email-html">{t.manualOutboundEmailHtmlLabel}</Label>
                <Textarea
                  id="manual-outbound-email-html"
                  value={formData.emailHtml}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, emailHtml: event.target.value }))
                  }
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">
                {submitting ? t.manualOutboundSending : t.manualOutboundSend}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.manualOutboundSummaryTitle}</CardTitle>
          <CardDescription>{t.manualOutboundDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t.manualOutboundSummaryRecipient}</p>
            <p className="font-medium">
              {formData.recipientType === "external-email"
                ? formData.email || "-"
                : selectedUser
                  ? `${selectedUser.name || "-"} <${selectedUser.email}>`
                  : "-"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.manualOutboundSummaryChannel}</p>
            <p className="font-medium">
              {formData.recipientType === "external-email" ? "email" : formData.channel}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.manualOutboundSummaryTemplate}</p>
            <p className="font-medium">{formData.template}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.messageTitle}</p>
            <p className="font-medium">{formData.subject || "-"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
