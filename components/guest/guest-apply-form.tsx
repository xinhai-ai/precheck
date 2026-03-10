"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ClipboardList,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Globe2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { preApplicationSources } from "@/lib/pre-application/constants"
import type { QQGroupConfig } from "@/lib/pre-application/constants"
import { EmailWithDomainInput } from "@/components/ui/email-with-domain-input"
import {
  CaptchaChallengeDialog,
  type CaptchaProvider,
} from "@/components/captcha/captcha-challenge-dialog"
import { useAllowedEmailDomains } from "@/lib/hooks/use-allowed-email-domains"
import { PostContent } from "@/components/posts/post-content"
import type { Locale } from "@/lib/i18n/config"

interface GuestApplyFormProps {
  locale: Locale
  qqNumber: string
  dict: {
    title: string
    description: string
    fields: {
      essay: string
      essayHint: string
      source: string
      sourceOptional: string
      sourceDetail: string
      registerEmail: string
      registerEmailHint: string
      group: string
    }
    sources: Record<string, string>
    submit: string
    submitting: string
    submitSuccess: string
    submitFailed: string
    alreadySubmitted: string
    allowedDomainsTitle: string
    emailSuffixPlaceholder?: string
    validation: {
      sourceDetailRequired: string
      essayTooShort?: string
      essayTooLong?: string
    }
    status: {
      pending: string
      approved: string
      rejected: string
      disputed: string
    }
    reviewInfoTitle: string
    submittedAt: string
    review: {
      reviewer: string
      reviewedAt: string
      guidance: string
    }
    invite: {
      code: string
      expiresAt: string
      used: string
      unused: string
    }
  }
}

type GuestRecord = {
  id: string
  essay: string
  source: string | null
  sourceDetail: string | null
  registerEmail: string
  queryToken: string | null
  group: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISPUTED" | "ARCHIVED"
  guidance: string | null
  reviewedAt: string | null
  createdAt: string
  reviewedBy: { id: string; name: string | null; email: string } | null
  inviteCode: {
    id: string
    code: string
    expiresAt: string | null
    usedAt: string | null
  } | null
}

type SubmitQuotaStatus = {
  dailyGlobalLimit: number
  dailyUserLimit: number
  submitStartTime: string
  submitEndTime: string
  isWithinSubmitWindow: boolean
  quotaServiceAvailable: boolean
  userUsedToday: number | null
  userRemainingToday: number | null
  globalUsedToday: number | null
  globalRemainingToday: number | null
}

type SubmitPrecheckReason =
  | "submit_window_closed"
  | "user_quota_insufficient"
  | "quota_insufficient"
  | "service_unavailable"

type SubmitPrecheckResponse = {
  allowed: boolean
  reason: SubmitPrecheckReason | null
  submitQuotaStatus?: SubmitQuotaStatus | null
  captchaEnabled: boolean
  captchaProvider: CaptchaProvider | null
  captchaPublicConfig: Record<string, unknown> | null
}

export function GuestApplyForm({ locale, qqNumber, dict }: GuestApplyFormProps) {
  const [essayMinChars, setEssayMinChars] = useState(50)
  const [essayMaxChars, setEssayMaxChars] = useState(300)
  const [loadingRecord, setLoadingRecord] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [prechecking, setPrechecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [captchaDialogOpen, setCaptchaDialogOpen] = useState(false)
  const [captchaProvider, setCaptchaProvider] = useState<CaptchaProvider | null>(null)
  const [captchaPublicConfig, setCaptchaPublicConfig] = useState<Record<string, unknown> | null>(
    null,
  )
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const [record, setRecord] = useState<GuestRecord | null>(null)
  const [submitQuotaStatus, setSubmitQuotaStatus] = useState<SubmitQuotaStatus | null>(null)
  const [qqGroups, setQqGroups] = useState<QQGroupConfig[]>([])
  const [essayHint, setEssayHint] = useState(dict.fields.essayHint)
  const allowedDomains = useAllowedEmailDomains()
  const [formData, setFormData] = useState({
    essay: "",
    source: "",
    sourceDetail: "",
    registerEmail: "",
    group: "GROUP_ONE",
  })

  const loading = loadingRecord || loadingGroups

  const allowedDomainsText = useMemo(() => {
    const joiner = locale === "zh" ? "、" : ", "
    return allowedDomains.join(joiner)
  }, [locale, allowedDomains])

  const loadRecord = async () => {
    try {
      const res = await fetch("/api/guest/apply")
      if (res.ok) {
        const data = await res.json()
        if (data.record) setRecord(data.record)
        setSubmitQuotaStatus(data.submitQuotaStatus ?? null)
      }
    } catch (error) {
      console.error("Load guest application error:", error)
    } finally {
      setLoadingRecord(false)
    }
  }

  useEffect(() => {
    const loadQQGroups = async () => {
      try {
        const res = await fetch("/api/qq-groups")
        if (res.ok) {
          const data: QQGroupConfig[] = await res.json()
          setQqGroups(data)
          if (data.length > 0) {
            setFormData((prev) => {
              if (!data.some((g) => g.id === prev.group)) {
                return { ...prev, group: data[0].id }
              }
              return prev
            })
          }
        }
      } catch (error) {
        console.error("Failed to load QQ groups:", error)
      } finally {
        setLoadingGroups(false)
      }
    }
    loadQQGroups()
  }, [])

  useEffect(() => {
    const loadSystemConfig = async () => {
      try {
        const res = await fetch("/api/public/system-config")
        if (res.ok) {
          const data = await res.json()
          if (data.preApplicationEssayHint) {
            setEssayHint(data.preApplicationEssayHint)
          }
          if (typeof data.preApplicationEssayMinLength === "number") {
            setEssayMinChars(Math.max(1, Math.floor(data.preApplicationEssayMinLength)))
          }
          if (typeof data.preApplicationEssayMaxLength === "number") {
            setEssayMaxChars(Math.max(1, Math.floor(data.preApplicationEssayMaxLength)))
          }
        }
      } catch (error) {
        console.error("Failed to load system config:", error)
      }
    }
    loadSystemConfig()
  }, [])

  useEffect(() => {
    loadRecord()
  }, [])

  useEffect(() => {
    if (formData.source !== "OTHER" && formData.sourceDetail) {
      setFormData((prev) => ({ ...prev, sourceDetail: "" }))
    }
  }, [formData.source, formData.sourceDetail])

  const closeCaptchaDialog = () => {
    setCaptchaDialogOpen(false)
    setCaptchaProvider(null)
    setCaptchaPublicConfig(null)
    setCaptchaError(null)
  }

  const handleCaptchaDialogOpenChange = (open: boolean) => {
    if (!open) {
      closeCaptchaDialog()
      return
    }

    setCaptchaDialogOpen(true)
  }

  const getPrecheckFailureMessage = (result: SubmitPrecheckResponse) => {
    switch (result.reason) {
      case "submit_window_closed":
        return locale === "zh" ? "当前不在可提交时间段" : "Submissions are not open right now"
      case "service_unavailable":
        return locale === "zh"
          ? "提交额度信息暂不可用，请稍后重试"
          : "Submit quota information is temporarily unavailable. Please try again later."
      case "user_quota_insufficient":
      case "quota_insufficient":
      default:
        return locale === "zh" ? "当前配额不足" : "Insufficient quota right now"
    }
  }

  const isCaptchaChallengeMessage = (message?: string) =>
    Boolean(
      message &&
      (message.includes("人机验证") ||
        message.includes("验证码") ||
        message.toLowerCase().includes("captcha")),
    )

  const runSubmitPrecheck = async (): Promise<SubmitPrecheckResponse | null> => {
    const res = await fetch("/api/guest/apply/precheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const data = (await res.json().catch(() => ({}))) as Partial<SubmitPrecheckResponse> & {
      error?: string
    }

    if (data.submitQuotaStatus) {
      setSubmitQuotaStatus(data.submitQuotaStatus)
    }

    if (!res.ok) {
      toast.error(data.error || dict.submitFailed)
      return null
    }

    return {
      allowed: Boolean(data.allowed),
      reason: data.reason ?? null,
      submitQuotaStatus: data.submitQuotaStatus ?? null,
      captchaEnabled: Boolean(data.captchaEnabled),
      captchaProvider: data.captchaProvider ?? null,
      captchaPublicConfig: data.captchaPublicConfig ?? null,
    }
  }

  const submitApplication = async (captcha?: {
    provider: CaptchaProvider
    payload: Record<string, unknown>
  }) => {
    setSubmitting(true)
    setCaptchaError(null)

    try {
      const res = await fetch("/api/guest/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay: formData.essay,
          source: formData.source || null,
          sourceDetail: formData.source === "OTHER" ? formData.sourceDetail : null,
          registerEmail: formData.registerEmail,
          group: formData.group,
          captchaProvider: captcha?.provider ?? null,
          captchaPayload: captcha?.payload ?? null,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        const message = data.error || dict.submitFailed

        if (captcha && isCaptchaChallengeMessage(message)) {
          setCaptchaError(message)
          return false
        }

        closeCaptchaDialog()
        toast.error(message)
        if (res.status === 409) {
          await loadRecord()
        }
        return false
      }

      closeCaptchaDialog()
      toast.success(dict.submitSuccess)
      await loadRecord()
      return true
    } catch {
      if (!captcha) {
        closeCaptchaDialog()
      }
      toast.error(dict.submitFailed)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleCaptchaVerify = async (payload: Record<string, unknown>) => {
    if (!captchaProvider) {
      setCaptchaError(
        locale === "zh"
          ? "验证码供应商未准备好，请重试"
          : "Captcha provider is not ready. Please try again.",
      )
      return
    }

    await submitApplication({ provider: captchaProvider, payload })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEssayLength = formData.essay.trim().length
    if (trimmedEssayLength < essayMinChars) {
      const template =
        dict.validation.essayTooShort ||
        (locale === "zh"
          ? "申请内容不少于 {min} 个字符"
          : "Essay must be at least {min} characters")
      toast.error(template.replace("{min}", String(essayMinChars)))
      return
    }

    if (trimmedEssayLength > essayMaxChars) {
      const template =
        dict.validation.essayTooLong ||
        (locale === "zh" ? "申请内容最多 {max} 个字符" : "Essay must be at most {max} characters")
      toast.error(template.replace("{max}", String(essayMaxChars)))
      return
    }

    if (formData.source === "OTHER" && !formData.sourceDetail.trim()) {
      toast.error(dict.validation.sourceDetailRequired)
      return
    }

    setPrechecking(true)
    setCaptchaError(null)

    try {
      const precheck = await runSubmitPrecheck()
      if (!precheck) {
        return
      }

      if (!precheck.allowed) {
        toast.error(getPrecheckFailureMessage(precheck))
        return
      }

      if (!precheck.captchaEnabled || !precheck.captchaProvider || !precheck.captchaPublicConfig) {
        await submitApplication()
        return
      }

      setCaptchaProvider(precheck.captchaProvider)
      setCaptchaPublicConfig(precheck.captchaPublicConfig)
      setCaptchaDialogOpen(true)
    } catch {
      toast.error(dict.submitFailed)
    } finally {
      setPrechecking(false)
    }
  }

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString(locale) : "-"

  const getGroupLabel = (value: string) => {
    const qqGroup = qqGroups.find((g) => g.id === value)
    if (qqGroup) return locale === "en" && qqGroup.nameEn ? qqGroup.nameEn : qqGroup.name
    return value
  }

  const getSourceLabel = (value: string | null) => {
    if (!value) return dict.fields.sourceOptional
    const item = preApplicationSources.find((s) => s.value === value)
    if (!item) return value
    const key = item.labelKey.split(".").pop() || ""
    return dict.sources[key] || value
  }

  const status = dict.status as Record<string, string>
  const statusConfig: Record<
    string,
    { label: string; icon: typeof Clock; color: string; bg: string }
  > = {
    PENDING: {
      label: status.pending,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    APPROVED: {
      label: status.approved,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    REJECTED: {
      label: status.rejected,
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
    },
    DISPUTED: {
      label: status.disputed,
      icon: HelpCircle,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
    },
    ARCHIVED: {
      label: status.archived || "Archived",
      icon: Clock,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500/10",
    },
    PENDING_REVIEW: {
      label: status.pendingReview || "Pending Review",
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    ON_HOLD: {
      label: status.onHold || "On Hold",
      icon: Clock,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
  }

  const isValidEmail =
    formData.registerEmail.includes("@") && formData.registerEmail.split("@")[1]?.length > 0

  const renderQuotaCard = () => {
    if (!submitQuotaStatus) return null

    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe2 className="h-5 w-5" />
            {locale === "zh" ? "今日提交配额" : "Today's Submission Quota"}
          </CardTitle>
          <CardDescription>
            {locale === "zh"
              ? "显示个人与全站今日配额，以及当前是否在可提交时间段"
              : "Shows personal/global daily quota and whether submissions are currently open"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "个人剩余" : "Personal Remaining"}
              </p>
              <p className="text-xl font-semibold">
                {submitQuotaStatus.userRemainingToday ?? "-"} / {submitQuotaStatus.dailyUserLimit}
              </p>
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "今日已用" : "Used Today"}:{" "}
                {submitQuotaStatus.userUsedToday ?? "-"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "全站剩余" : "Global Remaining"}
              </p>
              <p className="text-xl font-semibold">
                {submitQuotaStatus.globalRemainingToday ?? "-"} /{" "}
                {submitQuotaStatus.dailyGlobalLimit}
              </p>
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "今日已用" : "Used Today"}:{" "}
                {submitQuotaStatus.globalUsedToday ?? "-"}
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
              <p className="text-xs text-muted-foreground">
                {locale === "zh" ? "提交时间段" : "Submit Window"}
              </p>
              <Badge
                variant={submitQuotaStatus.isWithinSubmitWindow ? "default" : "secondary"}
                className={cn(
                  submitQuotaStatus.isWithinSubmitWindow
                    ? "bg-emerald-600 hover:bg-emerald-600"
                    : "bg-amber-500/20 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                )}
              >
                {submitQuotaStatus.isWithinSubmitWindow
                  ? locale === "zh"
                    ? "当前可提交"
                    : "Open Now"
                  : locale === "zh"
                    ? "当前不可提交"
                    : "Closed Now"}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {submitQuotaStatus.submitStartTime} - {submitQuotaStatus.submitEndTime}{" "}
                (Asia/Shanghai)
              </p>
            </div>
          </div>
          {!submitQuotaStatus.quotaServiceAvailable && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
              {locale === "zh"
                ? "配额服务状态暂不可用，展示数据可能延迟。"
                : "Quota service is temporarily unavailable, displayed data may be delayed."}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (record) {
    const config = statusConfig[record.status] || statusConfig.PENDING
    const StatusIcon = config.icon

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{dict.title}</h1>
            <p className="text-sm text-muted-foreground">QQ: {qqNumber}</p>
          </div>
        </div>

        {renderQuotaCard()}

        <Card className="border-0 shadow-md">
          <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                {dict.reviewInfoTitle}
                <Badge
                  variant="secondary"
                  className={cn("gap-1.5 px-2.5 py-1 font-medium", config.bg, config.color)}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </Badge>
              </CardTitle>
              <CardDescription>
                {dict.submittedAt}: {formatDate(record.createdAt)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {record.reviewedBy && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{dict.review.reviewer}</p>
                  <p className="font-medium">
                    {record.reviewedBy?.name || record.reviewedBy?.email || "-"}
                  </p>
                </div>
                <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground">{dict.review.reviewedAt}</p>
                  <p className="font-medium">{formatDate(record.reviewedAt)}</p>
                </div>
              </div>
            )}

            {record.guidance && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{dict.review.guidance}</p>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <PostContent content={record.guidance} emptyMessage="" />
                </div>
              </div>
            )}

            {record.inviteCode && (
              <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                <div className="space-y-1">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {dict.invite.code}
                  </p>
                  <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {record.inviteCode.code}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {dict.invite.expiresAt}
                  </p>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    {formatDate(record.inviteCode.expiresAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {dict.invite.used}
                  </p>
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">
                    {record.inviteCode.usedAt ? dict.invite.used : dict.invite.unused}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{dict.fields.registerEmail}</p>
                <p className="font-medium truncate">{record.registerEmail}</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{dict.fields.group}</p>
                <p className="font-medium">{getGroupLabel(record.group)}</p>
              </div>
              <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{dict.fields.source}</p>
                <p className="font-medium">{getSourceLabel(record.source)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{dict.fields.essay}</p>
              <div className="rounded-xl border bg-muted/30 p-4">
                <PostContent content={record.essay} emptyMessage="" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25"
        >
          <ClipboardList className="h-6 w-6 text-white" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dict.title}</h1>
          <p className="text-sm text-muted-foreground">
            {dict.description} · QQ: {qqNumber}
          </p>
        </div>
      </div>

      {renderQuotaCard()}

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{dict.submit}</CardTitle>
          <CardDescription>
            {dict.allowedDomainsTitle}: {allowedDomainsText}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="essay" className="text-sm font-medium">
                {dict.fields.essay}
              </Label>
              <Textarea
                id="essay"
                value={formData.essay}
                onChange={(e) => setFormData({ ...formData, essay: e.target.value })}
                rows={6}
                maxLength={essayMaxChars}
                placeholder={essayHint}
                className="resize-none rounded-xl"
                required
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="line-clamp-1">{essayHint}</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    formData.essay.length >= essayMinChars &&
                      formData.essay.length <= essayMaxChars &&
                      "text-emerald-600",
                  )}
                >
                  {formData.essay.length}/{essayMaxChars} ·{" "}
                  {locale === "zh" ? `最少 ${essayMinChars}` : `min ${essayMinChars}`}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{dict.fields.source}</Label>
                <Select
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value })}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder={dict.fields.sourceOptional} />
                  </SelectTrigger>
                  <SelectContent>
                    {preApplicationSources.map((source) => {
                      const key = source.labelKey.split(".").pop() || ""
                      return (
                        <SelectItem key={source.value} value={source.value}>
                          {dict.sources[key]}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {formData.source === "OTHER" && (
                  <Input
                    value={formData.sourceDetail}
                    onChange={(e) => setFormData({ ...formData, sourceDetail: e.target.value })}
                    placeholder={dict.fields.sourceDetail}
                    className="rounded-lg"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerEmail" className="text-sm font-medium">
                  {dict.fields.registerEmail}
                </Label>
                <EmailWithDomainInput
                  value={formData.registerEmail}
                  domains={allowedDomains}
                  onChange={(email) => setFormData({ ...formData, registerEmail: email })}
                  selectPlaceholder={dict.emailSuffixPlaceholder ?? ""}
                  inputId="registerEmail"
                  inputPlaceholder={dict.fields.registerEmailHint}
                />
                <p className="text-xs text-muted-foreground">{dict.fields.registerEmailHint}</p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label className="text-sm font-medium">{dict.fields.group}</Label>
                <RadioGroup
                  value={formData.group}
                  onValueChange={(value) => setFormData({ ...formData, group: value })}
                  className="flex flex-wrap gap-4"
                >
                  {qqGroups.map((group) => (
                    <label
                      key={group.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors",
                        formData.group === group.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <RadioGroupItem value={group.id} />
                      <span className="text-sm">
                        {locale === "en" && group.nameEn ? group.nameEn : group.name}
                      </span>
                      <span className="text-xs text-muted-foreground">({group.number})</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                prechecking ||
                submitting ||
                formData.essay.length < essayMinChars ||
                formData.essay.length > essayMaxChars ||
                !isValidEmail
              }
              className="w-full sm:w-auto"
              size="lg"
            >
              {prechecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {locale === "zh" ? "正在检查..." : "Checking..."}
                </>
              ) : submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {dict.submitting}
                </>
              ) : (
                dict.submit
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <CaptchaChallengeDialog
        open={captchaDialogOpen}
        provider={captchaProvider}
        publicConfig={captchaPublicConfig}
        onOpenChange={handleCaptchaDialogOpenChange}
        onVerify={handleCaptchaVerify}
        loading={submitting}
        error={captchaError}
      />
    </motion.div>
  )
}
