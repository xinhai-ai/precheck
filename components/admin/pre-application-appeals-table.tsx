"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ClipboardCheck,
  Eye,
  Loader2,
  RefreshCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import { PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS } from "@/lib/pre-application/appeal-utils"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

type AppealStatus = "PENDING" | "REJECTED" | "OVERRIDDEN"
type AppealSource = "USER_APPEAL" | "ADMIN_REVIEW_REQUEST"
type AppealFilter = "ALL" | AppealStatus
type ReviewAction = "REJECT" | "APPROVE"
type DialogMode = ReviewAction | "VIEW"

type AppealRejectionSnapshot = {
  essay: string
  guidance: string | null
  reviewedAt: string | null
  reviewedBy: {
    id: string
    name: string | null
    email: string
  } | null
}

type AppealRecord = {
  id: string
  preApplicationId: string
  userId: string
  status: AppealStatus
  source: AppealSource
  initiatedById: string
  reason: string
  reviewComment: string | null
  reviewedById: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  rejectionSnapshot: AppealRejectionSnapshot | null
  user: {
    id: string
    name: string | null
    email: string
  }
  initiatedBy: {
    id: string
    name: string | null
    email: string
  }
  reviewedBy: {
    id: string
    name: string | null
    email: string
  } | null
  preApplication: {
    id: string
    status: string
    queryToken: string | null
    registerEmail: string
    guidance: string | null
    reviewedAt: string | null
    createdAt: string
    updatedAt: string
  }
}

type AppealListResponse = {
  records: AppealRecord[]
  total: number
  page: number
  limit: number
  stats: {
    pending: number
    rejected: number
    overridden: number
  }
}

type ReviewDialogState = {
  appeal: AppealRecord
  mode: DialogMode
}

interface AdminPreApplicationAppealsTableProps {
  locale: Locale
  dict: Dictionary
}

const ALL_STATUS_QUERY = "PENDING,REJECTED,OVERRIDDEN"

function formatDateTime(value: string | null, locale: Locale, fallback: string) {
  if (!value) return fallback

  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function truncateText(value: string, maxLength = 160) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}…`
}

function formatStatusText(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function StatCard({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/50 ${
        active ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
      </div>
    </button>
  )
}

export function AdminPreApplicationAppealsTable({
  locale,
  dict,
}: AdminPreApplicationAppealsTableProps) {
  const pageT = dict.admin.preApplicationAppealsPage
  const [records, setRecords] = useState<AppealRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [statusFilter, setStatusFilter] = useState<AppealFilter>("PENDING")
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState | null>(null)
  const [reviewComment, setReviewComment] = useState("")
  const [applySubmitBan, setApplySubmitBan] = useState(true)
  const [submitBanDays, setSubmitBanDays] = useState(PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [stats, setStats] = useState({
    pending: 0,
    rejected: 0,
    overridden: 0,
  })

  const getStatusLabel = useCallback(
    (status: AppealStatus | AppealFilter) => {
      switch (status) {
        case "ALL":
          return pageT.filters.all
        case "PENDING":
          return pageT.filters.pending
        case "REJECTED":
          return pageT.filters.rejected
        case "OVERRIDDEN":
          return pageT.filters.overridden
      }
    },
    [pageT.filters.all, pageT.filters.overridden, pageT.filters.pending, pageT.filters.rejected],
  )


  const getSourceLabel = useCallback(
    (source: AppealSource) => {
      if (source === "ADMIN_REVIEW_REQUEST") {
        return ((pageT.fields as Record<string, string>).adminReviewRequestSource || "管理员复审")
      }

      return ((pageT.fields as Record<string, string>).userAppealSource || "用户申诉")
    },
    [pageT.fields],
  )

  const fetchAppeals = useCallback(async () => {
    setLoading(true)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      })

      if (search) {
        params.set("search", search)
      }

      if (statusFilter === "ALL") {
        params.set("status", ALL_STATUS_QUERY)
      } else {
        params.set("status", statusFilter)
      }

      const response = await fetch(`/api/admin/pre-application-appeals?${params.toString()}`)
      const rawData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(resolveApiErrorMessage(rawData, dict) ?? pageT.messages.loadError)
      }

      const data = rawData as Partial<AppealListResponse>
      setRecords(data.records ?? [])
      setTotal(data.total ?? 0)
      setStats({
        pending: data.stats?.pending ?? 0,
        rejected: data.stats?.rejected ?? 0,
        overridden: data.stats?.overridden ?? 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : pageT.messages.loadError
      toast.error(message)
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [dict, page, pageSize, pageT.messages.loadError, search, statusFilter])

  useEffect(() => {
    void fetchAppeals()
  }, [fetchAppeals])

  const closeReviewDialog = () => {
    setReviewDialog(null)
    setReviewComment("")
    setApplySubmitBan(true)
    setSubmitBanDays(PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS)
    setReviewingId(null)
  }

  const handleReviewDialogOpenChange = (open: boolean) => {
    if (reviewingId) {
      return
    }

    if (!open) {
      closeReviewDialog()
    }
  }

  const openReviewDialog = (appeal: AppealRecord, mode: DialogMode) => {
    setReviewDialog({ appeal, mode })
    setReviewComment("")
    setApplySubmitBan(mode === "REJECT")
    setSubmitBanDays(PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS)
  }

  const submitReview = async () => {
    if (!reviewDialog || reviewDialog.mode === "VIEW") return

    const nextComment = reviewComment.trim()
    if (!nextComment) {
      toast.error(pageT.messages.commentRequired)
      return
    }

    const nextSubmitBanDays = applySubmitBan ? Math.trunc(submitBanDays) : undefined
    if (
      reviewDialog.mode === "REJECT" &&
      applySubmitBan &&
      (!nextSubmitBanDays || nextSubmitBanDays < 1)
    ) {
      toast.error(pageT.messages.submitBanDaysInvalid || "请输入有效的封禁天数")
      return
    }

    setReviewingId(reviewDialog.appeal.id)

    try {
      const response = await fetch(
        `/api/admin/pre-application-appeals/${reviewDialog.appeal.id}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: reviewDialog.mode,
            reviewComment: nextComment,
            applySubmitBan: reviewDialog.mode === "REJECT" ? applySubmitBan : undefined,
            submitBanDays:
              reviewDialog.mode === "REJECT" && applySubmitBan ? nextSubmitBanDays : undefined,
            locale,
          }),
        },
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          resolveApiErrorMessage(data, dict) ??
            dict.apiErrors.admin.preApplicationAppeals.failedToReview,
        )
      }

      toast.success(
        reviewDialog.mode === "REJECT" ? pageT.messages.rejected : pageT.messages.overridden,
      )

      closeReviewDialog()

      if (page > 1 && records.length === 1) {
        setPage(page - 1)
      } else {
        void fetchAppeals()
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : dict.apiErrors.admin.preApplicationAppeals.failedToReview
      toast.error(message)
      setReviewingId(null)
    }
  }

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextSearch = searchInput.trim()

    if (nextSearch === search && page === 1) {
      void fetchAppeals()
      return
    }

    setPage(1)
    setSearch(nextSearch)
  }

  const handleClearFilters = () => {
    const isDefaultState =
      page === 1 && search === "" && searchInput === "" && statusFilter === "PENDING"

    setSearch("")
    setSearchInput("")
    setStatusFilter("PENDING")
    setPage(1)

    if (isDefaultState) {
      void fetchAppeals()
    }
  }

  const columns = useMemo<Column<AppealRecord>[]>(() => {
    const notReviewedText = pageT.states.notReviewed
    const noneText = pageT.states.none
    const unknownUserText = pageT.states.unknownUser

    return [
      {
        key: "user",
        label: pageT.columns.user,
        width: "24%",
        render: (item) => (
          <div className="space-y-1">
            <div className="font-medium">{item.user.name || unknownUserText}</div>
            <div className="text-sm text-muted-foreground">{item.user.email}</div>
            <div className="text-xs text-muted-foreground">
              {pageT.fields.registerEmail}: {item.preApplication.registerEmail}
            </div>
            <div className="text-xs text-muted-foreground">
              {pageT.fields.queryToken}: {item.preApplication.queryToken || noneText}
            </div>
          </div>
        ),
      },
      {
        key: "reason",
        label: pageT.columns.reason,
        width: "32%",
        render: (item) => (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{getSourceLabel(item.source)}</Badge>
              <Badge variant="secondary">
                {((pageT.fields as Record<string, string>).initiatedBy || "发起人")}: {item.initiatedBy.name || item.initiatedBy.email}
              </Badge>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {truncateText(item.reason)}
            </p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                {pageT.fields.preApplicationStatus}: {formatStatusText(item.preApplication.status)}
              </span>
              {item.reviewComment && (
                <span>
                  {pageT.fields.reviewComment}: {truncateText(item.reviewComment, 80)}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "status",
        label: pageT.columns.status,
        width: "12%",
        render: (item) => (
          <Badge
            variant={
              item.status === "REJECTED"
                ? "destructive"
                : item.status === "OVERRIDDEN"
                  ? "default"
                  : "secondary"
            }
          >
            {getStatusLabel(item.status)}
          </Badge>
        ),
      },
      {
        key: "submittedAt",
        label: pageT.columns.submittedAt,
        width: "14%",
        render: (item) => (
          <span className="text-sm text-muted-foreground">
            {formatDateTime(item.createdAt, locale, notReviewedText)}
          </span>
        ),
      },
      {
        key: "reviewed",
        label: pageT.columns.reviewed,
        width: "18%",
        render: (item) => (
          <div className="space-y-1 text-sm">
            <div className="font-medium">
              {item.reviewedBy?.name || item.reviewedBy?.email || notReviewedText}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTime(item.reviewedAt, locale, notReviewedText)}
            </div>
          </div>
        ),
      },
      {
        key: "actions",
        label: pageT.columns.actions,
        width: "16%",
        align: "right",
        render: (item) => {
          const isReviewing = reviewingId === item.id

          if (item.status !== "PENDING") {
            return (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isReviewing}
                  onClick={() => openReviewDialog(item, "VIEW")}
                >
                  <Eye className="h-4 w-4" />
                  {pageT.actions.view}
                </Button>
              </div>
            )
          }

          return (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReviewing}
                onClick={() => openReviewDialog(item, "REJECT")}
              >
                <XCircle className="h-4 w-4" />
                {pageT.actions.reject}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isReviewing}
                onClick={() => openReviewDialog(item, "APPROVE")}
              >
                <ShieldCheck className="h-4 w-4" />
                {pageT.actions.override}
              </Button>
            </div>
          )
        },
      },
    ]
  }, [getSourceLabel, getStatusLabel, locale, pageT, reviewingId])

  const reviewDialogText = reviewDialog
    ? reviewDialog.mode === "REJECT"
      ? {
          title: pageT.dialog.rejectTitle,
          description: pageT.dialog.rejectDescription,
          placeholder: pageT.dialog.rejectPlaceholder,
          confirm: pageT.actions.reject,
        }
      : reviewDialog.mode === "APPROVE"
        ? {
            title: pageT.dialog.overrideTitle,
            description: pageT.dialog.overrideDescription,
            placeholder: pageT.dialog.overridePlaceholder,
            confirm: pageT.actions.override,
          }
        : {
            title: pageT.dialog.viewTitle,
            description: pageT.dialog.viewDescription,
            placeholder: "",
            confirm: pageT.actions.close,
          }
    : null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={AlertTriangle}
          label={pageT.stats.pending}
          value={stats.pending}
          active={statusFilter === "PENDING"}
          onClick={() => {
            setPage(1)
            setStatusFilter("PENDING")
          }}
        />
        <StatCard
          icon={XCircle}
          label={pageT.stats.rejected}
          value={stats.rejected}
          active={statusFilter === "REJECTED"}
          onClick={() => {
            setPage(1)
            setStatusFilter("REJECTED")
          }}
        />
        <StatCard
          icon={ClipboardCheck}
          label={pageT.stats.overridden}
          value={stats.overridden}
          active={statusFilter === "OVERRIDDEN"}
          onClick={() => {
            setPage(1)
            setStatusFilter("OVERRIDDEN")
          }}
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{pageT.title}</CardTitle>
              <CardDescription>{pageT.description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                {pageT.actions.clear}
              </Button>
              <Button type="button" variant="outline" onClick={() => void fetchAppeals()}>
                <RefreshCcw className="h-4 w-4" />
                {pageT.actions.refresh}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <form className="flex flex-1 gap-2" onSubmit={handleSearchSubmit}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={pageT.searchPlaceholder}
                  className="pl-9"
                />
              </div>
              <Button type="submit">{dict.dashboard.search}</Button>
            </form>

            <div className="grid gap-2 sm:min-w-48">
              <Label htmlFor="appeal-status-filter">{pageT.filters.status}</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setPage(1)
                  setStatusFilter(value as AppealFilter)
                }}
              >
                <SelectTrigger id="appeal-status-filter" className="w-full">
                  <SelectValue placeholder={pageT.filters.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{pageT.filters.all}</SelectItem>
                  <SelectItem value="PENDING">{pageT.filters.pending}</SelectItem>
                  <SelectItem value="REJECTED">{pageT.filters.rejected}</SelectItem>
                  <SelectItem value="OVERRIDDEN">{pageT.filters.overridden}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={records}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPage(1)
              setPageSize(nextPageSize)
            }}
            loading={loading}
            compact
            rowHeight={84}
            loadingText={pageT.actions.refresh}
            emptyMessage={pageT.states.empty}
            perPageText={dict.dashboard.perPage || "Per page"}
            summaryFormatter={({ total: totalCount, page: currentPage, totalPages }) =>
              `${totalCount.toLocaleString()} · ${currentPage}/${Math.max(totalPages, 1)}`
            }
            mobileCardRender={(item) => (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.user.name || pageT.states.unknownUser}</div>
                    <div className="text-sm text-muted-foreground">{item.user.email}</div>
                  </div>
                  <Badge
                    variant={
                      item.status === "REJECTED"
                        ? "destructive"
                        : item.status === "OVERRIDDEN"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <p className="whitespace-pre-wrap break-words">
                    {truncateText(item.reason, 220)}
                  </p>
                  <p className="text-muted-foreground">
                    {pageT.fields.registerEmail}: {item.preApplication.registerEmail}
                  </p>
                  <p className="text-muted-foreground">
                    {pageT.columns.submittedAt}:{" "}
                    {formatDateTime(item.createdAt, locale, pageT.states.notReviewed)}
                  </p>
                </div>

                {item.status === "PENDING" ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openReviewDialog(item, "REJECT")}
                    >
                      {pageT.actions.reject}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => openReviewDialog(item, "APPROVE")}
                    >
                      {pageT.actions.override}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => openReviewDialog(item, "VIEW")}
                    >
                      <Eye className="h-4 w-4" />
                      {pageT.actions.view}
                    </Button>
                  </div>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={!!reviewDialog} onOpenChange={handleReviewDialogOpenChange}>
        <DialogContent
          className="sm:max-w-2xl"
          onEscapeKeyDown={(event) => {
            if (reviewingId) {
              event.preventDefault()
            }
          }}
          onInteractOutside={(event) => {
            if (reviewingId) {
              event.preventDefault()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{reviewDialogText?.title}</DialogTitle>
            <DialogDescription>{reviewDialogText?.description}</DialogDescription>
          </DialogHeader>

          {reviewDialog && (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {reviewDialog.appeal.user.name || pageT.states.unknownUser}
                </div>
                <div className="text-muted-foreground">{reviewDialog.appeal.user.email}</div>
                <div className="mt-2 text-muted-foreground">
                  {pageT.fields.queryToken}:{" "}
                  {reviewDialog.appeal.preApplication.queryToken || pageT.states.none}
                </div>
                <div className="mt-2 text-muted-foreground">
                  {pageT.fields.registerEmail}: {reviewDialog.appeal.preApplication.registerEmail}
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-foreground">
                  {reviewDialog.appeal.reason}
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{pageT.dialog.rejectionSnapshotTitle}</div>

                  {reviewDialog.appeal.rejectionSnapshot ? (
                    <div className="mt-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {pageT.fields.reviewedBy}
                          </div>
                          <div className="mt-1 font-medium">
                            {reviewDialog.appeal.rejectionSnapshot.reviewedBy?.name ||
                              reviewDialog.appeal.rejectionSnapshot.reviewedBy?.email ||
                              pageT.states.unknownUser}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {dict.preApplication.review.reviewedAt}
                          </div>
                          <div className="mt-1 font-medium">
                            {formatDateTime(
                              reviewDialog.appeal.rejectionSnapshot.reviewedAt,
                              locale,
                              pageT.states.notReviewed,
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">
                          {dict.preApplication.review.guidance}
                        </div>
                        <div className="mt-1 whitespace-pre-wrap break-words">
                          {reviewDialog.appeal.rejectionSnapshot.guidance || pageT.states.none}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-muted-foreground">
                          {dict.preApplication.fields.essay}
                        </div>
                        <div className="mt-1 rounded-md bg-muted/40 p-3 whitespace-pre-wrap break-words text-foreground">
                          {reviewDialog.appeal.rejectionSnapshot.essay}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-muted-foreground">
                      {pageT.states.rejectionSnapshotEmpty}
                    </p>
                  )}
                </div>

                {reviewDialog.mode === "VIEW" ? (
                  reviewDialog.appeal.reviewComment ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        {pageT.fields.reviewComment}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-foreground">
                        {reviewDialog.appeal.reviewComment}
                      </div>
                    </>
                  ) : null
                ) : (
                  <>
                    <Label htmlFor="review-comment">{pageT.dialog.commentLabel}</Label>
                    <Textarea
                      id="review-comment"
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder={reviewDialogText?.placeholder}
                      maxLength={2000}
                      rows={6}
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {reviewComment.length}/2000
                    </p>

                    {reviewDialog.mode === "REJECT" ? (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {pageT.dialog.rejectApplySubmitBan || "驳回后封禁提交权限"}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {pageT.dialog.rejectApplySubmitBanDesc ||
                                "开启后，会同时限制该用户继续提交新的预申请。"}
                            </p>
                          </div>
                          <Switch checked={applySubmitBan} onCheckedChange={setApplySubmitBan} />
                        </div>

                        {applySubmitBan ? (
                          <div className="space-y-2">
                            <Label htmlFor="reject-submit-ban-days">
                              {pageT.dialog.rejectSubmitBanDays || "封禁天数"}
                            </Label>
                            <Input
                              id="reject-submit-ban-days"
                              type="number"
                              min={1}
                              max={3650}
                              value={submitBanDays}
                              onChange={(event) =>
                                setSubmitBanDays(Math.max(0, Number(event.target.value) || 0))
                              }
                              className="w-32 text-center"
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeReviewDialog}
              disabled={!!reviewingId}
            >
              {reviewDialog?.mode === "VIEW" ? pageT.actions.close : pageT.actions.cancel}
            </Button>
            {reviewDialog?.mode !== "VIEW" ? (
              <Button
                type="button"
                onClick={submitReview}
                disabled={!reviewDialog || !!reviewingId}
              >
                {reviewingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {reviewDialogText?.confirm}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
