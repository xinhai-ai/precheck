"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { PostContent } from "@/components/posts/post-content"
import {
  History,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ClipboardList,
  Loader2,
  Users,
  Heart,
  Sparkles,
  Trash2,
  MessageCircle,
  Copy,
  Check,
  Globe2,
} from "lucide-react"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import type { Role } from "@prisma/client"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import { preApplicationSources } from "@/lib/pre-application/constants"
import type { QQGroupConfig } from "@/lib/pre-application/constants"
import { EmailWithDomainInput } from "@/components/ui/email-with-domain-input"
import { PreApplicationAppealDialog } from "@/components/dashboard/pre-application-appeal-dialog"
import {
  CaptchaChallengeDialog,
  type CaptchaProvider,
} from "@/components/captcha/captcha-challenge-dialog"
import { useAllowedEmailDomains } from "@/lib/hooks/use-allowed-email-domains"
import { cn } from "@/lib/utils"
import { collectFingerprint } from "@/lib/fingerprint/client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type PreApplicationVersion = {
  id: string
  version: number
  essay: string
  source: string | null
  sourceDetail: string | null
  registerEmail: string
  group: string
  status: string
  createdAt: string
}

type PreApplicationRecord = {
  id: string
  essay: string
  source: string | null
  sourceDetail: string | null
  registerEmail: string
  queryToken: string | null
  group: string
  status:
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "DISPUTED"
    | "ARCHIVED"
    | "PENDING_REVIEW"
    | "ON_HOLD"
  guidance: string | null
  reviewedAt: string | null
  updatedAt: string
  createdAt: string
  version: number
  resubmitCount: number
  reviewedBy: { id: string; name: string | null; email: string } | null
  inviteCode: {
    id: string
    code: string
    expiresAt: string | null
    usedAt: string | null
    assignedAt: string | null
  } | null
  versions?: PreApplicationVersion[]
}

type PreApplicationDraft = {
  id: string
  essay: string
  source: string | null
  sourceDetail: string | null
  registerEmail: string
  group: string
  updatedAt: string
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

type SubmitBanStatus = {
  isSubmitBanned: boolean
  submitBannedUntil: string | null
  remainingSeconds: number
}

type PreApplicationReapplyState = {
  eligible: boolean
  started: boolean
  canStart: boolean
  eligibleAt: string | null
  startedAt: string | null
}

type SubmitPrecheckReason =
  | "submit_banned"
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
  captchaTicket: string | null
  submitBannedUntil?: string | null
  remainingSeconds?: number | null
}

type PreApplicationAppealRecord = {
  id: string
  preApplicationId: string
  userId: string
  source: "USER_APPEAL" | "ADMIN_REVIEW_REQUEST"
  initiatedById: string
  status: "PENDING" | "REJECTED" | "OVERRIDDEN"
  reason: string
  reviewedAt: string | null
  reviewComment: string | null
  submitBanApplied?: boolean
  submitBanDays?: number | null
  submitBanUntil?: string | null
  autoRejected?: boolean
  autoRejectedPattern?: string | null
  createdAt: string
  updatedAt: string
  initiatedBy?: { id: string; name: string | null; email: string } | null
  reviewedBy: { id: string; name: string | null; email: string } | null
}

type PreApplicationAppealAvailability = {
  canCreate: boolean
  reason:
    | "APPEAL_DISABLED"
    | "PRE_APPLICATION_NOT_REJECTED"
    | "PENDING_APPEAL_EXISTS"
    | "APPEAL_COOLDOWN_ACTIVE"
    | null
  cooldownRemainingSeconds: number
}

interface PreApplicationFormProps {
  locale: Locale
  dict: Dictionary
  initialRecords?: PreApplicationRecord[]
  initialReapply?: PreApplicationReapplyState | null
  maxResubmitCount?: number
  userEmail?: string
  userRole?: Role
}

// Loading Skeleton 组件
function FormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </div>
      <Card className="border-0 shadow-md">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-10 w-28 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}

export function PreApplicationForm({
  locale,
  dict,
  initialRecords,
  initialReapply,
  maxResubmitCount: initialMaxResubmit = 3,
  userEmail,
  userRole,
}: PreApplicationFormProps) {
  const router = useRouter()
  const t = dict.preApplication
  const emailSuffixPlaceholder = t.emailSuffixPlaceholder ?? ""
  const [essayMinChars, setEssayMinChars] = useState(50)
  const [essayMaxChars, setEssayMaxChars] = useState(300)
  const [loading, setLoading] = useState(!initialRecords)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [records, setRecords] = useState<PreApplicationRecord[]>(initialRecords || [])
  const [maxResubmitCount, setMaxResubmitCount] = useState(initialMaxResubmit)
  const [activeTab, setActiveTab] = useState<"form" | "history">("form")
  const [essayHint, setEssayHint] = useState(t.fields.essayHint)
  const [queueInfo, setQueueInfo] = useState<{
    totalPending: number
    position: number
    aheadCount: number
  } | null>(null)
  const [submitQuotaStatus, setSubmitQuotaStatus] = useState<SubmitQuotaStatus | null>(null)
  const [submitBanStatus, setSubmitBanStatus] = useState<SubmitBanStatus | null>(null)
  const [reapply, setReapply] = useState<PreApplicationReapplyState>(
    initialReapply ?? {
      eligible: false,
      started: false,
      canStart: false,
      eligibleAt: null,
      startedAt: null,
    },
  )
  const [draft, setDraft] = useState<PreApplicationDraft | null>(null)
  const [appeals, setAppeals] = useState<PreApplicationAppealRecord[]>([])
  const [appealAvailability, setAppealAvailability] =
    useState<PreApplicationAppealAvailability | null>(null)
  const [appealDialogOpen, setAppealDialogOpen] = useState(false)
  const [appealLoadError, setAppealLoadError] = useState<string | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [clearingDraft, setClearingDraft] = useState(false)
  const [startingNewApplication, setStartingNewApplication] = useState(false)
  const [prechecking, setPrechecking] = useState(false)
  const [captchaDialogOpen, setCaptchaDialogOpen] = useState(false)
  const [captchaProvider, setCaptchaProvider] = useState<CaptchaProvider | null>(null)
  const [captchaPublicConfig, setCaptchaPublicConfig] = useState<Record<string, unknown> | null>(
    null,
  )
  const [captchaTicket, setCaptchaTicket] = useState<string | null>(null)
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const allowedDomains = useAllowedEmailDomains()
  const [formData, setFormData] = useState({
    essay: "",
    source: "",
    sourceDetail: "",
    registerEmail: userEmail || "",
    group: "GROUP_ONE",
  })

  // QQ 群配置（动态加载）
  const [qqGroups, setQqGroups] = useState<QQGroupConfig[]>([])

  // AI 预审状态
  type AIPreviewResult = {
    suggestion: "APPROVE" | "REJECT" | "DISPUTE"
    confidence: number
    scores: {
      relevance: number
      authenticity: number
      completeness: number
      expression: number
    }
    reasoning: string
  }
  const [aiPreviewLoading, setAiPreviewLoading] = useState(false)
  const [aiPreviewResult, setAiPreviewResult] = useState<AIPreviewResult | null>(null)
  const [aiPreviewError, setAiPreviewError] = useState<string | null>(null)

  const allowedDomainsText = useMemo(() => {
    const joiner = locale === "zh" ? "、" : ", "
    return allowedDomains.join(joiner)
  }, [locale, allowedDomains])

  const latest = records[0] ?? null
  const pendingAppeal = appeals.find((appeal) => appeal.status === "PENDING") ?? null
  const canStartNewApplication = latest?.status === "ARCHIVED" && reapply.canStart
  const isNewRoundStarted = latest?.status === "ARCHIVED" && reapply.started
  const isEditing = Boolean(latest)
  const hasReviewInfo = Boolean(
    latest?.reviewedAt || latest?.reviewedBy || latest?.guidance || latest?.inviteCode,
  )
  const remainingResubmits = latest
    ? maxResubmitCount - (latest.resubmitCount || 0)
    : maxResubmitCount
  const hasResolvedAppealState =
    latest?.status !== "REJECTED" || (!appealLoadError && !!appealAvailability)
  const canResubmit =
    latest?.status === "REJECTED" &&
    hasResolvedAppealState &&
    !pendingAppeal &&
    (maxResubmitCount === 0 || remainingResubmits > 0)
  // DISPUTED 状态且没有邀请码时可以修改
  const canEditDisputed = latest?.status === "DISPUTED" && !latest?.inviteCode
  // 管理员可以删除自己的申请记录（用于测试）
  const isAdmin = userRole === "ADMIN" || userRole === "SUPER_ADMIN"
  const canDelete = isAdmin && latest
  const isSubmitBanned = submitBanStatus?.isSubmitBanned ?? false

  // 删除申请记录

  const handleStartNewApplication = async () => {
    setStartingNewApplication(true)
    try {
      const res = await fetch("/api/pre-application/reapply/start", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const message =
          resolveApiErrorMessage(data, dict) ??
          (((t as Record<string, unknown>).startNewApplicationFailed as string) || "开始新申请失败")
        toast.error(message)
        return
      }

      setReapply(
        (data?.reapply as PreApplicationReapplyState | undefined) ?? {
          eligible: true,
          started: true,
          canStart: false,
          eligibleAt: reapply.eligibleAt,
          startedAt: new Date().toISOString(),
        },
      )
      setDraft(null)
      setFormData({
        essay: "",
        source: "",
        sourceDetail: "",
        registerEmail: userEmail || "",
        group: qqGroups[0]?.id || "GROUP_ONE",
      })
      toast.success(
        (((t as Record<string, unknown>).startNewApplicationSuccess as string) || "已开始新一轮申请")
      )
      await loadRecord(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (((t as Record<string, unknown>).startNewApplicationFailed as string) ||
            "开始新申请失败"),
      )
    } finally {
      setStartingNewApplication(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch("/api/pre-application", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          resolveApiErrorMessage(data, dict) ??
          ((t as Record<string, unknown>).deleteFailed as string) ??
          "删除失败"
        toast.error(message)
        return
      }
      toast.success(((t as Record<string, unknown>).deleteSuccess as string) ?? "申请记录已删除")
      setRecords([])
      setAppeals([])
      setAppealAvailability(null)
      setAppealLoadError(null)
      setFormData({
        essay: "",
        source: "",
        sourceDetail: "",
        registerEmail: userEmail || "",
        group: qqGroups[0]?.id || "GROUP_ONE",
      })
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (((t as Record<string, unknown>).deleteFailed as string) ?? "删除失败"),
      )
    } finally {
      setDeleting(false)
    }
  }

  const loadRecord = async (withLoading = true): Promise<boolean> => {
    if (withLoading) {
      setLoading(true)
    }
    try {
      const [res, draftRes, appealRes] = await Promise.all([
        fetch("/api/pre-application"),
        fetch("/api/pre-application/draft"),
        fetch("/api/pre-application/appeal"),
      ])
      if (!res.ok) throw new Error(t.loadFailed)
      const [data, draftData] = await Promise.all([
        res.json(),
        draftRes.ok ? draftRes.json() : Promise.resolve({ draft: null }),
      ])
      const nextRecords = data.records || []
      let appealRefreshSucceeded = true

      setRecords(nextRecords)
      setReapply(
        (data.reapply as PreApplicationReapplyState | undefined) ?? {
          eligible: false,
          started: false,
          canStart: false,
          eligibleAt: null,
          startedAt: null,
        },
      )
      setDraft((draftData?.draft as PreApplicationDraft | null) ?? null)

      if (appealRes.ok) {
        const appealData = await appealRes.json()
        setAppeals((appealData?.appeals as PreApplicationAppealRecord[] | undefined) ?? [])
        setAppealAvailability(
          (appealData?.availability as PreApplicationAppealAvailability | null | undefined) ?? null,
        )
        setAppealLoadError(null)
      } else {
        appealRefreshSucceeded = false
        const appealErrorData = await appealRes.json().catch(() => ({}))
        const appealMessage =
          resolveApiErrorMessage(appealErrorData, dict) ??
          ((t as Record<string, unknown>).appealLoadError as string) ??
          "Failed to refresh appeal status. Showing the last known appeal state."
        setAppealLoadError(appealMessage)
        console.error("Pre-application appeal load error:", appealRes.status)
      }

      if (data.maxResubmitCount) setMaxResubmitCount(data.maxResubmitCount)
      setQueueInfo(data.queueInfo ?? null)
      setSubmitQuotaStatus(data.submitQuotaStatus ?? null)
      setSubmitBanStatus((data.submitBanStatus as SubmitBanStatus | null) ?? null)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("pre-application:updated", {
            detail: { count: nextRecords.length },
          }),
        )
      }

      return appealRefreshSucceeded
    } catch (error) {
      console.error("Pre-application load error:", error)
      toast.error(t.loadFailed)
      return false
    } finally {
      if (withLoading) {
        setLoading(false)
      }
    }
  }

  // 检查是否有可用邀请码
  useEffect(() => {
    if (!initialRecords) {
      loadRecord(true)
      return
    }

    loadRecord(false)
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

  // 加载 QQ 群配置
  useEffect(() => {
    const loadQQGroups = async () => {
      try {
        const res = await fetch("/api/qq-groups")
        if (res.ok) {
          const data: QQGroupConfig[] = await res.json()
          setQqGroups(data)
          // 如果当前选择的群不在可用列表中，自动选择第一个
          if (data.length > 0 && !data.some((g) => g.id === formData.group)) {
            setFormData((prev) => ({ ...prev, group: data[0].id }))
          }
        }
      } catch (error) {
        console.error("Failed to load QQ groups:", error)
      }
    }
    loadQQGroups()
  }, [])

  useEffect(() => {
    if (draft) {
      setFormData({
        essay: draft.essay || "",
        source: draft.source || "",
        sourceDetail: draft.sourceDetail || "",
        registerEmail: draft.registerEmail || userEmail || "",
        group: draft.group || qqGroups[0]?.id || "GROUP_ONE",
      })
      return
    }

    if (!latest || latest.status === "APPROVED" || latest.status === "ARCHIVED") {
      return
    }

    setFormData({
      essay: latest.essay || "",
      source: latest.source || "",
      sourceDetail: latest.sourceDetail || "",
      registerEmail: latest.registerEmail || userEmail || "",
      group: latest.group || qqGroups[0]?.id || "GROUP_ONE",
    })
  }, [draft?.id, draft?.updatedAt, latest?.id, latest?.status, qqGroups, userEmail])

  useEffect(() => {
    if (formData.source !== "OTHER" && formData.sourceDetail) {
      setFormData((prev) => ({ ...prev, sourceDetail: "" }))
    }
  }, [formData.source, formData.sourceDetail])

  const statusConfig: Record<
    PreApplicationRecord["status"],
    { label: string; icon: typeof Clock; color: string; bg: string }
  > = {
    PENDING: {
      label: t.status.pending,
      icon: Clock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    APPROVED: {
      label: t.status.approved,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    REJECTED: {
      label: t.status.rejected,
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10",
    },
    DISPUTED: {
      label: t.status.disputed || "待补充",
      icon: HelpCircle,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10",
    },
    ARCHIVED: {
      label: t.status.archived || "已归档",
      icon: Clock,
      color: "text-slate-600 dark:text-slate-400",
      bg: "bg-slate-500/10",
    },
    PENDING_REVIEW: {
      label: t.status.pendingReview || "待复核",
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    ON_HOLD: {
      label: t.status.onHold || "暂缓处理",
      icon: Clock,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
  }

  const StatusBadge = ({ status }: { status: PreApplicationRecord["status"] }) => {
    const config = statusConfig[status] || statusConfig.PENDING
    const Icon = config.icon
    return (
      <Badge
        variant="secondary"
        className={cn("gap-1.5 px-2.5 py-1 font-medium", config.bg, config.color)}
      >
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </Badge>
    )
  }

  const getSourceLabel = (value: string | null) => {
    if (!value) return t.fields.sourceOptional
    const item = preApplicationSources.find((source) => source.value === value)
    if (!item) return value
    const key = item.labelKey.split(".").pop() || ""
    return (t.sources as Record<string, string>)[key] || value
  }

  const getGroupLabel = (value: string) => {
    // 优先从动态加载的 QQ 群配置中获取
    const qqGroup = qqGroups.find((g) => g.id === value)
    if (qqGroup) {
      return locale === "en" && qqGroup.nameEn ? qqGroup.nameEn : qqGroup.name
    }
    // 回退到字典翻译
    const keyMap: Record<string, string> = {
      GROUP_ONE: "groupOne",
      GROUP_TWO: "groupTwo",
      GROUP_THREE: "groupThree",
    }
    const key = keyMap[value]
    return key ? (t.groups as Record<string, string>)[key] || value : value
  }

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString(locale) : "-"

  const formatRemainingDuration = (remainingSeconds: number) => {
    const total = Math.max(0, Math.floor(remainingSeconds))
    const days = Math.floor(total / 86400)
    const hours = Math.floor((total % 86400) / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const safeMinutes = Math.max(1, minutes)

    if (locale === "zh") {
      if (days > 0) return `${days}天${hours}小时`
      if (hours > 0) return `${hours}小时${safeMinutes}分钟`
      return `${safeMinutes}分钟`
    }

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${safeMinutes}m`
    return `${safeMinutes}m`
  }

  const renderAppealStatusContent = () => {
    if (!latest || latest.status !== "REJECTED") {
      return null
    }

    if (pendingAppeal || appealAvailability?.reason === "PENDING_APPEAL_EXISTS") {
      return (
        <p className="text-rose-700 dark:text-rose-300">
          {((t as Record<string, unknown>).appealPending as string) ||
            "You already have an appeal under review."}
        </p>
      )
    }

    if (appealAvailability?.reason === "APPEAL_DISABLED") {
      return (
        <p className="text-rose-700 dark:text-rose-300">
          {((t as Record<string, unknown>).appealClosed as string) ||
            "Appeals are currently closed."}
        </p>
      )
    }

    if (appealAvailability?.reason === "APPEAL_COOLDOWN_ACTIVE") {
      const template =
        ((t as Record<string, unknown>).appealCooldown as string) ||
        "You can submit another appeal in {time}."

      return (
        <p className="text-rose-700 dark:text-rose-300">
          {template.replace(
            "{time}",
            formatRemainingDuration(appealAvailability.cooldownRemainingSeconds),
          )}
        </p>
      )
    }

    if (appealAvailability?.canCreate) {
      return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-rose-700 dark:text-rose-300">
            {((t as Record<string, unknown>).appealCtaHint as string) ||
              "If you believe the decision should be reviewed again, you can submit an appeal."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAppealDialogOpen(true)}
            className="w-full border-rose-200 bg-white/80 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-100 dark:hover:bg-rose-950/50 sm:w-auto"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {((t as Record<string, unknown>).appealButton as string) || "Submit Appeal"}
          </Button>
        </div>
      )
    }

    if (appealLoadError) {
      return <p className="text-rose-700 dark:text-rose-300">{appealLoadError}</p>
    }

    return null
  }

  const handleSaveDraft = async () => {
    if (latest?.status === "APPROVED" || (latest?.status === "ARCHIVED" && !reapply.started)) {
      return
    }

    setSavingDraft(true)
    try {
      const res = await fetch("/api/pre-application/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay: formData.essay,
          source: formData.source || null,
          sourceDetail: formData.source === "OTHER" ? formData.sourceDetail : null,
          registerEmail: formData.registerEmail,
          group: formData.group,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          resolveApiErrorMessage(data, dict) ??
          ((t as Record<string, unknown>).draftSaveFailed as string) ??
          "保存草稿失败"
        toast.error(message)
        return
      }

      const data = await res.json()
      setDraft((data?.draft as PreApplicationDraft | null) ?? null)
      toast.success(((t as Record<string, unknown>).draftSaveSuccess as string) ?? "草稿已保存")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (((t as Record<string, unknown>).draftSaveFailed as string) ?? "保存草稿失败"),
      )
    } finally {
      setSavingDraft(false)
    }
  }

  const handleClearDraft = async () => {
    setClearingDraft(true)
    try {
      const res = await fetch("/api/pre-application/draft", { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          resolveApiErrorMessage(data, dict) ??
          ((t as Record<string, unknown>).draftDeleteFailed as string) ??
          "清空草稿失败"
        toast.error(message)
        return
      }

      setDraft(null)
      toast.success(((t as Record<string, unknown>).draftDeleteSuccess as string) ?? "草稿已清空")
      if (latest && latest.status !== "APPROVED") {
        setFormData({
          essay: latest.essay || "",
          source: latest.source || "",
          sourceDetail: latest.sourceDetail || "",
          registerEmail: latest.registerEmail || userEmail || "",
          group: latest.group || qqGroups[0]?.id || "GROUP_ONE",
        })
      } else if (!latest) {
        setFormData({
          essay: "",
          source: "",
          sourceDetail: "",
          registerEmail: userEmail || "",
          group: qqGroups[0]?.id || "GROUP_ONE",
        })
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (((t as Record<string, unknown>).draftDeleteFailed as string) ?? "清空草稿失败"),
      )
    } finally {
      setClearingDraft(false)
    }
  }

  const closeCaptchaDialog = () => {
    setCaptchaDialogOpen(false)
    setCaptchaProvider(null)
    setCaptchaPublicConfig(null)
    setCaptchaTicket(null)
    setCaptchaError(null)
  }

  const handleCaptchaDialogOpenChange = (open: boolean) => {
    if (!open) {
      closeCaptchaDialog()
      return
    }

    setCaptchaDialogOpen(true)
  }

  const getApiErrorMeta = (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return undefined
    }

    const error = (payload as { error?: unknown }).error
    if (!error || typeof error !== "object") {
      return undefined
    }

    return "meta" in error && typeof (error as { meta?: unknown }).meta === "object"
      ? ((error as { meta?: Record<string, unknown> }).meta ?? undefined)
      : undefined
  }

  const getCaptchaErrorMessage = (payload: unknown) => {
    const meta = getApiErrorMeta(payload)
    if (meta && typeof meta.detail === "string" && meta.detail.trim()) {
      return meta.detail.trim()
    }

    const directError =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error.trim()
        : ""

    return directError || undefined
  }

  const isCaptchaChallengeMessage = (message?: string) =>
    Boolean(
      message &&
      (message.includes("人机验证") ||
        message.includes("验证码") ||
        message.toLowerCase().includes("captcha")),
    )

  const getPrecheckFailureMessage = (result: SubmitPrecheckResponse) => {
    if (result.reason === "submit_banned") {
      const remainingSeconds =
        typeof result.remainingSeconds === "number" ? result.remainingSeconds : 0
      if (remainingSeconds > 0) {
        const template =
          ((t as Record<string, unknown>).submitBanErrorWithRemaining as string) ||
          "你的提交权限已被管理员暂时封禁，剩余 {time}"
        return template.replace("{time}", formatRemainingDuration(remainingSeconds))
      }

      return (
        ((t as Record<string, unknown>).submitBanDescription as string) ||
        "管理员已暂时禁止你的预申请正式提交。"
      )
    }

    if (result.reason === "submit_window_closed") {
      return locale === "zh" ? "当前不在可提交时间段" : "Submissions are not open right now"
    }

    if (result.reason === "service_unavailable") {
      return (
        ((t as Record<string, unknown>).submitQuotaServiceUnavailable as string) ||
        (locale === "zh"
          ? "提交额度信息暂不可用，请稍后重试"
          : "Submit quota information is temporarily unavailable. Please try again later.")
      )
    }

    return locale === "zh" ? "当前配额不足" : "Insufficient quota right now"
  }

  const runSubmitPrecheck = async (): Promise<SubmitPrecheckResponse | null> => {
    const res = await fetch("/api/pre-application/precheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    const data = (await res.json().catch(() => ({}))) as Partial<SubmitPrecheckResponse>

    if (data.submitQuotaStatus) {
      setSubmitQuotaStatus(data.submitQuotaStatus)
    }

    if (data.reason === "submit_banned") {
      setSubmitBanStatus({
        isSubmitBanned: true,
        submitBannedUntil: data.submitBannedUntil ?? null,
        remainingSeconds: typeof data.remainingSeconds === "number" ? data.remainingSeconds : 0,
      })
    }

    if (!res.ok) {
      toast.error(resolveApiErrorMessage(data as never, dict) ?? t.submitFailed)
      return null
    }

    return {
      allowed: Boolean(data.allowed),
      reason: data.reason ?? null,
      submitQuotaStatus: data.submitQuotaStatus ?? null,
      captchaEnabled: Boolean(data.captchaEnabled),
      captchaProvider: data.captchaProvider ?? null,
      captchaPublicConfig: data.captchaPublicConfig ?? null,
      captchaTicket: data.captchaTicket ?? null,
      submitBannedUntil: data.submitBannedUntil ?? null,
      remainingSeconds: data.remainingSeconds ?? null,
    }
  }

  const submitApplication = async (captcha?: {
    provider: CaptchaProvider
    payload: Record<string, unknown>
    ticket: string | null
  }) => {
    setSubmitting(true)
    setCaptchaError(null)

    try {
      const isCreatingNewRound = latest?.status === "ARCHIVED" && reapply.started
      const method = latest && !isCreatingNewRound ? "PUT" : "POST"
      const fingerprintPayload = await collectFingerprint()
      const res = await fetch("/api/pre-application", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          essay: formData.essay,
          source: formData.source || null,
          sourceDetail: formData.source === "OTHER" ? formData.sourceDetail : null,
          registerEmail: formData.registerEmail,
          group: formData.group,
          version: latest?.version,
          captchaProvider: captcha?.provider ?? null,
          captchaPayload: captcha?.payload ?? null,
          captchaTicket: captcha?.ticket ?? null,
          ...fingerprintPayload,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = resolveApiErrorMessage(data, dict) ?? t.submitFailed
        const captchaMessage = getCaptchaErrorMessage(data)
        const errorObject = data?.error
        const errorCode =
          errorObject && typeof errorObject === "object" && typeof errorObject.code === "string"
            ? errorObject.code
            : undefined
        const errorMeta = getApiErrorMeta(data)

        if (captcha && isCaptchaChallengeMessage(captchaMessage)) {
          closeCaptchaDialog()
          toast.error(
            captchaMessage ||
              (locale === "zh"
                ? "人机验证未通过，请重新提交"
                : "Captcha verification failed. Please resubmit."),
          )
          return false
        }

        closeCaptchaDialog()

        if (res.status === 403 && errorCode === ApiErrorKeys.preApplication.submitBanned) {
          const remainingSeconds =
            errorMeta && typeof errorMeta.remainingSeconds === "number"
              ? errorMeta.remainingSeconds
              : null

          if (remainingSeconds && remainingSeconds > 0) {
            const template =
              ((t as Record<string, unknown>).submitBanErrorWithRemaining as string) ||
              "你的提交权限已被管理员暂时封禁，剩余 {time}"
            toast.error(template.replace("{time}", formatRemainingDuration(remainingSeconds)))
          } else {
            toast.error(message)
          }

          await loadRecord(false)
          return false
        }

        if (res.status === 409 && errorCode === ApiErrorKeys.preApplication.versionConflict) {
          toast.error(message)
          await loadRecord()
          return false
        }

        toast.error(message)
        return false
      }

      closeCaptchaDialog()
      toast.success(method === "PUT" ? t.updateSuccess : t.submitSuccess)
      setDraft(null)
      await loadRecord()
      return true
    } catch (error) {
      closeCaptchaDialog()
      toast.error(error instanceof Error ? error.message : t.submitFailed)
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

    if (!captchaTicket) {
      closeCaptchaDialog()
      toast.error(
        locale === "zh"
          ? "验证码票据已失效，请重新提交"
          : "Captcha ticket expired. Please resubmit.",
      )
      return
    }

    await submitApplication({ provider: captchaProvider, payload, ticket: captchaTicket })
  }

  const handleSubmit = async () => {
    const trimmedEssayLength = formData.essay.trim().length
    if (trimmedEssayLength < essayMinChars) {
      const template = t.validation?.essayTooShort || "申请小作文至少需要 {min} 个字符"
      toast.error(template.replace("{min}", String(essayMinChars)))
      return
    }

    if (trimmedEssayLength > essayMaxChars) {
      const template =
        t.validation?.essayTooLong || "申请小作文最多允许 {max} 个字符，请精简后再提交"
      toast.error(template.replace("{max}", String(essayMaxChars)))
      return
    }

    if (latest?.status === "APPROVED") {
      toast.error(t.alreadySubmitted)
      return
    }

    if (canStartNewApplication) {
      toast.error(
        (((t as Record<string, unknown>).startNewApplicationFirst as string) || "请先开始新一轮申请")
      )
      return
    }

    if (latest?.status === "ARCHIVED" && !reapply.started) {
      toast.error(
        (((t as Record<string, unknown>).startNewApplicationFirst as string) || "请先开始新一轮申请")
      )
      return
    }

    if (latest?.status === "REJECTED" && pendingAppeal) {
      toast.error(
        ((t as Record<string, unknown>).appealPending as string) ||
          "You already have an appeal under review.",
      )
      return
    }

    if (latest?.status === "REJECTED" && (!appealAvailability || appealLoadError)) {
      toast.error(
        appealLoadError ||
          ((t as Record<string, unknown>).appealLoadError as string) ||
          "Failed to refresh appeal status. Please try again.",
      )
      return
    }

    if (latest?.status === "REJECTED" && remainingResubmits <= 0) {
      toast.error(t.maxResubmitExceeded || `已达到最大重新提交次数限制 (${maxResubmitCount} 次)`)
      return
    }

    if (formData.source === "OTHER" && !formData.sourceDetail.trim()) {
      toast.error(t.validation.sourceDetailRequired)
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
      setCaptchaTicket(precheck.captchaTicket ?? null)
      setCaptchaDialogOpen(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.submitFailed)
    } finally {
      setPrechecking(false)
    }
  }

  // AI 预审检测
  const aiPreviewT = (t as unknown as Record<string, unknown>).aiPreview as
    | Record<string, unknown>
    | undefined
  const handleAIPreview = async () => {
    if (formData.essay.length < essayMinChars) {
      toast.error(
        aiPreviewT?.minCharsHint
          ? String(aiPreviewT.minCharsHint).replace("{min}", String(essayMinChars))
          : `至少输入 ${essayMinChars} 个字符后可检测`,
      )
      return
    }

    setAiPreviewLoading(true)
    setAiPreviewError(null)
    setAiPreviewResult(null)

    try {
      const res = await fetch("/api/pre-application/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ essay: formData.essay }),
      })

      if (!res.ok) {
        const errorText = res.status === 503 ? aiPreviewT?.notConfigured : aiPreviewT?.error
        setAiPreviewError(String(errorText || "检测失败"))
        return
      }

      const data = await res.json()
      setAiPreviewResult(data.result)
    } catch {
      setAiPreviewError(String(aiPreviewT?.error || "检测失败，请稍后重试"))
    } finally {
      setAiPreviewLoading(false)
    }
  }

  // AI 建议配置
  const getAISuggestionConfig = (suggestion: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      APPROVE: {
        label: String(
          (aiPreviewT?.suggestion as Record<string, string> | undefined)?.approve || "内容质量良好",
        ),
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
      },
      REJECT: {
        label: String(
          (aiPreviewT?.suggestion as Record<string, string> | undefined)?.reject ||
            "建议修改后提交",
        ),
        color: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-500/10",
      },
      DISPUTE: {
        label: String(
          (aiPreviewT?.suggestion as Record<string, string> | undefined)?.dispute || "建议补充完善",
        ),
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
      },
    }
    return configs[suggestion] || configs.DISPUTE
  }

  // 分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-600 dark:text-emerald-400"
    if (score >= 50) return "text-amber-600 dark:text-amber-400"
    return "text-rose-600 dark:text-rose-400"
  }

  if (loading) return <FormSkeleton />

  const hasHistory = latest?.versions && latest.versions.length > 1
  const canSubmitForm =
    !isSubmitBanned &&
    (!latest || latest.status === "PENDING" || canResubmit || canEditDisputed || isNewRoundStarted)
  const showForm =
    !latest ||
    isNewRoundStarted ||
    (latest.status !== "APPROVED" && latest.status !== "ARCHIVED")
  const appealStatusContent = renderAppealStatusContent()

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* 页面标题 */}
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
      </div>

      {canStartNewApplication && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>
                {((t as Record<string, unknown>).reapplyReadyTitle as string) || "可以开始新一轮申请"}
              </CardTitle>
              <CardDescription>
                {((t as Record<string, unknown>).reapplyReadyDescription as string) ||
                  "管理员已重置你的申请状态。点击下方按钮后，将进入一张全新的空白申请表单。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {((t as Record<string, unknown>).reapplyReadyHint as string) ||
                  "历史申请会继续保留在下方记录中，新一轮申请不会自动复制旧内容。"}
              </div>
              <Button onClick={handleStartNewApplication} disabled={startingNewApplication}>
                {startingNewApplication ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {((t as Record<string, unknown>).startingNewApplication as string) ||
                      "启动中..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {((t as Record<string, unknown>).startNewApplication as string) ||
                      "开始新申请"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* PENDING 状态 - 排队信息和温馨提示 */}
      {latest?.status === "PENDING" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* 排队信息卡片 */}
          {queueInfo && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-transparent p-4 dark:border-blue-900/50 dark:from-blue-950/30">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  {(t as unknown as Record<string, string>).queueTitle || "排队信息"}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/20 p-2 text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {queueInfo.position}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                      {(t as unknown as Record<string, string>).yourPosition || "您的位置"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/20 p-2 text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {queueInfo.aheadCount}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                      {(t as unknown as Record<string, string>).aheadOfYou || "前面还有"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/20 p-2 text-center">
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {queueInfo.totalPending}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                      {(t as unknown as Record<string, string>).totalPending || "总待审核"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 温馨提示 */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-transparent p-4 dark:border-amber-900/50 dark:from-amber-950/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <Heart className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-amber-800 dark:text-amber-200">
                {(t as unknown as Record<string, string>).warmTipTitle || "温馨提示"}
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300 leading-relaxed">
                {(t as unknown as Record<string, string>).warmTipMessage ||
                  "感谢您的耐心等待！我们正在认真审核每一份申请，通常会在 1-3 个工作日内完成。审核结果会通过站内信和邮件通知您，请留意查收。"}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 状态警告 */}
      {latest?.status === "REJECTED" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 to-transparent p-4 dark:border-rose-900/50 dark:from-rose-950/30"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
            <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-rose-800 dark:text-rose-200">
              {t.resubmitWarningTitle || "申请已被驳回"}
            </p>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300">
              {canResubmit
                ? (t.resubmitRemaining || "您还可以重新提交 {count} 次").replace(
                    "{count}",
                    String(remainingResubmits),
                  )
                : t.maxResubmitExceeded || "已达到最大重新提交次数限制"}
            </p>
            {appealStatusContent && (
              <div className="mt-3 rounded-lg border border-rose-200/70 bg-white/60 p-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                {appealStatusContent}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {latest && (
        <PreApplicationAppealDialog
          open={appealDialogOpen}
          onOpenChange={setAppealDialogOpen}
          preApplicationId={latest.id}
          locale={locale}
          dict={dict}
          onSubmitted={async () => {
            const refreshed = await loadRecord(false)
            router.refresh()
            return refreshed
          }}
        />
      )}

      {/* DISPUTED 状态提示 */}
      {latest?.status === "DISPUTED" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-transparent p-4 dark:border-orange-900/50 dark:from-orange-950/30"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
            <HelpCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-orange-800 dark:text-orange-200">
              {t.disputedWarningTitle || "申请需要补充信息"}
            </p>
            <p className="mt-0.5 text-orange-700 dark:text-orange-300">
              {canEditDisputed
                ? t.disputedCanEdit || "请根据审核意见补充或修改您的申请内容"
                : t.disputedWithCode || "您的申请已关联邀请码，等待最终审核"}
            </p>
          </div>
        </motion.div>
      )}

      {latest && hasHistory ? (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "form" | "history")}>
          <TabsList className="mb-4 h-11 p-1 bg-muted/50">
            <TabsTrigger value="form" className="gap-2 data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t.currentApplication || "当前申请"}</span>
              <span className="sm:hidden">{locale === "zh" ? "申请" : "Form"}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:shadow-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">{t.versionHistory || "版本历史"}</span>
              <span className="sm:hidden">{locale === "zh" ? "历史" : "History"}</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {latest.versions?.length || 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="form" asChild>
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                {renderMainContent()}
              </motion.div>
            </TabsContent>

            <TabsContent value="history" asChild>
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                {renderVersionHistory()}
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      ) : (
        renderMainContent()
      )}

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

  function renderMainContent() {
    return (
      <div className="space-y-6">
        {submitBanStatus?.isSubmitBanned && (
          <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-rose-700 dark:text-rose-300">
                {(t.submitBanTitle as string) || "提交权限已封禁"}
              </CardTitle>
              <CardDescription className="text-rose-700/80 dark:text-rose-300/80">
                {(t.submitBanDescription as string) || "管理员已暂时禁止你的预申请正式提交。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-rose-800 dark:text-rose-200">
              <p>
                {((t.submitBanRemaining as string) || "剩余时间：{time}").replace(
                  "{time}",
                  formatRemainingDuration(submitBanStatus.remainingSeconds),
                )}
              </p>
              {submitBanStatus.submitBannedUntil && (
                <p>
                  {((t.submitBanUntil as string) || "解封时间：{time}").replace(
                    "{time}",
                    formatDate(submitBanStatus.submitBannedUntil),
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {submitQuotaStatus && (
          <Card className="border-0 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe2 className="h-5 w-5" />
                {(t.submitQuotaTitle as string) || "今日提交配额"}
              </CardTitle>
              <CardDescription>
                {(t.submitQuotaDesc as string) ||
                  "显示个人与全站今日配额，以及当前是否在可提交时间段"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {(t.submitQuotaPersonal as string) || "个人剩余"}
                  </p>
                  <p className="text-xl font-semibold">
                    {submitQuotaStatus.userRemainingToday ?? "-"} /{" "}
                    {submitQuotaStatus.dailyUserLimit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(t.submitQuotaUsed as string) || "今日已用"}:{" "}
                    {submitQuotaStatus.userUsedToday ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {(t.submitQuotaGlobal as string) || "全站剩余"}
                  </p>
                  <p className="text-xl font-semibold">
                    {submitQuotaStatus.globalRemainingToday ?? "-"} /{" "}
                    {submitQuotaStatus.dailyGlobalLimit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(t.submitQuotaUsed as string) || "今日已用"}:{" "}
                    {submitQuotaStatus.globalUsedToday ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {(t.submitQuotaWindow as string) || "提交时间段"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={submitQuotaStatus.isWithinSubmitWindow ? "default" : "secondary"}
                      className={cn(
                        submitQuotaStatus.isWithinSubmitWindow
                          ? "bg-emerald-600 hover:bg-emerald-600"
                          : "bg-amber-500/20 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
                      )}
                    >
                      {submitQuotaStatus.isWithinSubmitWindow
                        ? (t.submitQuotaWindowOpen as string) || "当前可提交"
                        : (t.submitQuotaWindowClosed as string) || "当前不可提交"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {submitQuotaStatus.submitStartTime} - {submitQuotaStatus.submitEndTime}{" "}
                    (Asia/Shanghai)
                  </p>
                </div>
              </div>
              {!submitQuotaStatus.quotaServiceAvailable && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                  {(t.submitQuotaServiceUnavailable as string) ||
                    "配额服务状态暂不可用，展示数据可能延迟。"}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* 审核信息卡片 */}
        {latest && hasReviewInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    {t.reviewInfoTitle}
                    <StatusBadge status={latest.status} />
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {t.submittedAt}：{formatDate(latest.createdAt)}
                    {latest.version > 1 && ` · v${latest.version}`}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t.review.reviewer}</p>
                    {latest.reviewedBy ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/private-chats", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ adminId: latest.reviewedBy!.id }),
                            })
                            if (!res.ok) throw new Error()
                            const { chatId } = await res.json()
                            router.push(`/${locale}/dashboard/private-chats/${chatId}`)
                          } catch {
                            toast.error(t.review.chatFailed || "发起私信失败")
                          }
                        }}
                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        {latest.reviewedBy.name || latest.reviewedBy.email}
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <p className="font-medium">-</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t.review.reviewedAt}</p>
                    <p className="font-medium">{formatDate(latest.reviewedAt)}</p>
                  </div>
                </div>

                {latest.guidance && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t.review.guidance}</p>
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <PostContent content={latest.guidance} emptyMessage={t.review.guidance} />
                    </div>
                  </div>
                )}

                {latest.inviteCode && (
                  <div className="grid gap-4 sm:grid-cols-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t.invite.code}
                      </p>
                      <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                        {latest.inviteCode.code}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t.invite.expiresAt}
                      </p>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300">
                        {formatDate(latest.inviteCode.expiresAt)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        {t.invite.used}
                      </p>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300">
                        {latest.inviteCode.usedAt ? t.invite.used : t.invite.unused}
                      </p>
                    </div>
                  </div>
                )}

                {/* 审核通过但未记录具体邀请码时，提示改为人工发码 */}
                {latest.status === "APPROVED" && !latest.inviteCode && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    <p className="font-medium">
                      {((t as Record<string, unknown>).manualIssueTitle as string) || "人工发码"}
                    </p>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      {((t as Record<string, unknown>).manualIssueHint as string) ||
                        "邀请码改为人工发放，请联系管理员并在控制台记录人工发码。"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 已提交信息卡片 */}
        {latest && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    {hasReviewInfo ? t.formInfoTitle : t.status.label}
                    {!hasReviewInfo && <StatusBadge status={latest.status} />}
                  </CardTitle>
                  {/* 管理员删除按钮 */}
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={deleting}
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1.5" />
                          )}
                          {((t as Record<string, unknown>).deleteRecord as string) || "删除记录"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {((t as Record<string, unknown>).deleteConfirmTitle as string) ||
                              "确认删除申请记录？"}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {((t as Record<string, unknown>).deleteConfirmDesc as string) ||
                              "此操作将删除您的预申请记录和所有版本历史，删除后可以重新填写申请。此操作不可撤销。"}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            {((t as Record<string, unknown>).cancel as string) || "取消"}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {((t as Record<string, unknown>).confirmDelete as string) || "确认删除"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <CardDescription>{t.submitted}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">{t.fields.registerEmail}</p>
                    <p className="font-medium truncate">{latest.registerEmail}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">{t.fields.group}</p>
                    <p className="font-medium">{getGroupLabel(latest.group)}</p>
                  </div>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">{t.fields.source}</p>
                    <p className="font-medium">{getSourceLabel(latest.source)}</p>
                  </div>
                  {latest.sourceDetail && (
                    <div className="space-y-1 p-3 rounded-lg bg-muted/30 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t.fields.sourceDetail}</p>
                      <p className="font-medium">{latest.sourceDetail}</p>
                    </div>
                  )}
                  {latest.queryToken && (
                    <div className="space-y-1 p-3 rounded-lg bg-muted/30 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">{t.fields.queryToken}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm flex-1">{latest.queryToken}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(latest.queryToken!)
                            setCopiedToken(true)
                            setTimeout(() => setCopiedToken(false), 2000)
                          }}
                        >
                          {copiedToken ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t.fields.essay}</p>
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <PostContent content={latest.essay} emptyMessage={essayHint} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 编辑/提交表单 */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">
                  {latest?.status === "REJECTED"
                    ? t.resubmit || "重新提交"
                    : latest?.status === "DISPUTED"
                      ? t.editDisputed || "补充修改"
                      : latest
                        ? t.update
                        : t.submit}
                </CardTitle>
                <CardDescription>
                  {t.allowedDomainsTitle}：{allowedDomainsText}
                </CardDescription>
                {draft && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {(
                        ((t as Record<string, unknown>).draftSavedAt as string) ||
                        "已保存草稿：{time}"
                      ).replace("{time}", formatDate(draft.updatedAt))}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      disabled={clearingDraft || savingDraft}
                      onClick={handleClearDraft}
                    >
                      {clearingDraft
                        ? ((t as Record<string, unknown>).clearingDraft as string) || "清空中..."
                        : ((t as Record<string, unknown>).clearDraft as string) || "清空草稿"}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="essay" className="text-sm font-medium">
                    {t.fields.essay}
                  </Label>
                  <Textarea
                    id="essay"
                    value={formData.essay}
                    onChange={(event) => setFormData({ ...formData, essay: event.target.value })}
                    rows={6}
                    maxLength={essayMaxChars}
                    placeholder={essayHint}
                    className="resize-none rounded-xl"
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

                  {/* AI 预审检测按钮和结果 */}
                  <div className="space-y-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAIPreview}
                            disabled={aiPreviewLoading || formData.essay.length < essayMinChars}
                            className="gap-2"
                          >
                            {aiPreviewLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {String(aiPreviewT?.loading || "检测中...")}
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                {String(aiPreviewT?.button || "AI 检测")}
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{String(aiPreviewT?.title || "AI 内容检测")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* AI 预审错误 */}
                    {aiPreviewError && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                        {aiPreviewError}
                      </div>
                    )}

                    {/* AI 预审结果 */}
                    {aiPreviewResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border bg-muted/30 p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {String(aiPreviewT?.resultTitle || "检测结果")}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "px-2.5 py-1",
                              getAISuggestionConfig(aiPreviewResult.suggestion).bg,
                              getAISuggestionConfig(aiPreviewResult.suggestion).color,
                            )}
                          >
                            {getAISuggestionConfig(aiPreviewResult.suggestion).label}
                          </Badge>
                        </div>

                        {/* 分数展示 */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {(
                            [
                              ["relevance", "相关性"],
                              ["authenticity", "真实性"],
                              ["completeness", "完整性"],
                              ["expression", "表达能力"],
                            ] as const
                          ).map(([key, fallback]) => {
                            const score =
                              aiPreviewResult.scores[key as keyof typeof aiPreviewResult.scores]
                            const label =
                              (aiPreviewT?.scores as Record<string, string> | undefined)?.[key] ||
                              fallback
                            return (
                              <div
                                key={key}
                                className="rounded-lg bg-background/50 p-2 text-center"
                              >
                                <p className={cn("text-lg font-bold", getScoreColor(score))}>
                                  {score}
                                </p>
                                <p className="text-xs text-muted-foreground">{label}</p>
                              </div>
                            )
                          })}
                        </div>

                        {/* 改进建议 */}
                        {aiPreviewResult.reasoning && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {String(aiPreviewT?.suggestions || "改进建议")}
                            </p>
                            <p className="text-sm leading-relaxed">{aiPreviewResult.reasoning}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t.fields.source}</Label>
                    <Select
                      value={formData.source}
                      onValueChange={(value) => setFormData({ ...formData, source: value })}
                      disabled={isEditing && !canEditDisputed}
                    >
                      <SelectTrigger
                        disabled={isEditing && !canEditDisputed}
                        className="rounded-lg"
                      >
                        <SelectValue placeholder={t.fields.sourceOptional} />
                      </SelectTrigger>
                      <SelectContent>
                        {preApplicationSources.map((source) => {
                          const key = source.labelKey.split(".").pop() || ""
                          return (
                            <SelectItem key={source.value} value={source.value}>
                              {(t.sources as Record<string, string>)[key]}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    {formData.source === "OTHER" && (
                      <Input
                        value={formData.sourceDetail}
                        onChange={(event) =>
                          setFormData({ ...formData, sourceDetail: event.target.value })
                        }
                        placeholder={t.fields.sourceDetail}
                        readOnly={isEditing && !canEditDisputed}
                        className="rounded-lg"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="registerEmail" className="text-sm font-medium">
                      {t.fields.registerEmail}
                    </Label>
                    <EmailWithDomainInput
                      value={formData.registerEmail}
                      domains={allowedDomains}
                      onChange={(email) => setFormData({ ...formData, registerEmail: email })}
                      selectPlaceholder={emailSuffixPlaceholder}
                      inputId="registerEmail"
                      inputPlaceholder={t.fields.registerEmailHint}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">{t.fields.registerEmailHint}</p>
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <Label className="text-sm font-medium">{t.fields.group}</Label>
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

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  {latest?.status !== "APPROVED" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || prechecking || submitting || clearingDraft}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      {savingDraft ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {((t as Record<string, unknown>).savingDraft as string) || "保存中..."}
                        </>
                      ) : (
                        ((t as Record<string, unknown>).saveDraft as string) || "保存草稿"
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={prechecking || submitting || !canSubmitForm}
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
                        {t.submitting}
                      </>
                    ) : latest?.status === "REJECTED" ? (
                      t.resubmit || "重新提交"
                    ) : latest?.status === "DISPUTED" ? (
                      t.editDisputed || "提交修改"
                    ) : latest ? (
                      t.update
                    ) : (
                      t.submit
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    )
  }

  function renderVersionHistory() {
    if (!latest?.versions?.length) {
      return (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-muted/50 mb-4">
              <History className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">{t.noVersionHistory || "暂无版本历史"}</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {latest.versions.map((version, index) => (
          <motion.div
            key={version.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              className={cn(
                "border-0 shadow-md transition-all",
                index === 0 && "ring-2 ring-primary/20",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span className="font-mono">v{version.version}</span>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">
                        {t.currentVersion || "当前版本"}
                      </Badge>
                    )}
                    <StatusBadge status={version.status as PreApplicationRecord["status"]} />
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(version.createdAt)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">{t.fields.registerEmail}</span>
                    <p className="font-medium truncate">{version.registerEmail}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">{t.fields.group}</span>
                    <p className="font-medium">{getGroupLabel(version.group)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30">
                    <span className="text-xs text-muted-foreground">{t.fields.source}</span>
                    <p className="font-medium">{getSourceLabel(version.source)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t.fields.essay}</p>
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                    <PostContent content={version.essay} emptyMessage="" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    )
  }
}
