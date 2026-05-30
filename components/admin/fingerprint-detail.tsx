"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Monitor,
  Globe,
  Clock,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { getRiskLevel, RISK_LEVEL_COLORS } from "@/lib/fingerprint/constants"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"

interface FingerprintDetailProps {
  locale: Locale
  dict: Dictionary
  linkId: string
  onReviewed?: () => void
}

interface DetailData {
  id: string
  visitorId: string
  userIds: string[]
  riskScore: number
  status: string
  reviewedAt?: string | null
  reviewNote?: string | null
  reviewedBy?: {
    id: string
    name?: string | null
    email: string
  } | null
  users: Array<{
    id: string
    email: string
    name?: string | null
    status: string
    createdAt: string
    country?: string | null
  }>
  fingerprints: Array<{
    id: string
    visitorId: string
    browser?: string | null
    os?: string | null
    device?: string | null
    screenResolution?: string | null
    timezone?: string | null
    language?: string | null
    webglRenderer?: string | null
    canvasHash?: string | null
    ip?: string | null
    firstSeenAt: string
    lastSeenAt: string
  }>
  preApplications: Array<{
    id: string
    userId?: string | null
    registerEmail: string
    status: string
    createdAt: string
    fingerprintId?: string | null
  }>
}

export function FingerprintDetail({
  locale,
  dict,
  linkId,
  onReviewed,
}: FingerprintDetailProps) {
  const t = dict.admin.fingerprint

  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Review form
  const [reviewNote, setReviewNote] = useState("")
  const [banUsers, setBanUsers] = useState(false)
  const [banReason, setBanReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/fingerprints/${linkId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch")
      }
      const detail = await response.json()
      setData(detail)
    } catch {
      setError(t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [linkId, t.loadFailed])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleReview = async (status: "CONFIRMED" | "CLEARED" | "IGNORED") => {
    setSubmitting(true)

    try {
      const response = await fetch(`/api/admin/fingerprints/${linkId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note: reviewNote || undefined,
          banUsers: status === "CONFIRMED" && banUsers,
          banReason: banReason || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit review")
      }

      toast.success(t.review.success)
      onReviewed?.()
    } catch {
      toast.error(t.review.failed)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase() as keyof typeof t.status
    return t.status[key] ?? status
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-destructive">
        {error || t.loadFailed}
      </div>
    )
  }

  const riskLevel = getRiskLevel(data.riskScore)
  const riskColor = RISK_LEVEL_COLORS[riskLevel]
  const latestFingerprint = data.fingerprints[data.fingerprints.length - 1]
  const isPending = data.status === "PENDING"

  return (
    <div className="space-y-6 py-4">
      {/* Risk Score */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{t.columns.riskScore}</div>
          <div
            className={cn(
              "text-3xl font-bold",
              riskColor === "red" && "text-red-500",
              riskColor === "yellow" && "text-yellow-500",
              riskColor === "green" && "text-green-500",
            )}
          >
            {data.riskScore}
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-lg px-3 py-1",
            riskColor === "red" && "border-red-500 text-red-500",
            riskColor === "yellow" && "border-yellow-500 text-yellow-500",
            riskColor === "green" && "border-green-500 text-green-500",
          )}
        >
          {t.riskLevel[riskLevel]}
        </Badge>
      </div>

      <Separator />

      {/* Device Info */}
      {latestFingerprint && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              {t.detail.deviceInfo}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {latestFingerprint.browser && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.browser}</span>
                <span>{latestFingerprint.browser}</span>
              </div>
            )}
            {latestFingerprint.os && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.os}</span>
                <span>{latestFingerprint.os}</span>
              </div>
            )}
            {latestFingerprint.screenResolution && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.screen}</span>
                <span>{latestFingerprint.screenResolution}</span>
              </div>
            )}
            {latestFingerprint.timezone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.timezone}</span>
                <span>{latestFingerprint.timezone}</span>
              </div>
            )}
            {latestFingerprint.webglRenderer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.webgl}</span>
                <span className="truncate max-w-[200px]">
                  {latestFingerprint.webglRenderer}
                </span>
              </div>
            )}
            {latestFingerprint.ip && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t.detail.ip}</span>
                <span>{latestFingerprint.ip}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Linked Users & Applications */}
      <Accordion type="single" collapsible defaultValue="users">
        <AccordionItem value="users">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {t.detail.linkedUsers} ({data.users.length})
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {data.users.map((user, index) => (
                <div
                  key={user.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    index === 0 && "border-green-500/50 bg-green-500/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{user.email}</div>
                      {user.name && (
                        <div className="text-sm text-muted-foreground">
                          {user.name}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={user.status === "ACTIVE" ? "default" : "destructive"}
                      >
                        {user.status}
                      </Badge>
                      {index === 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          {locale === "zh" ? "最早注册" : "First registered"}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(user.createdAt)}
                    </div>
                    {user.country && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {user.country}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {data.preApplications.length > 0 && (
          <AccordionItem value="applications">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t.detail.preApplications} ({data.preApplications.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {data.preApplications.map((app) => (
                  <div key={app.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">{app.registerEmail}</div>
                      <Badge variant="outline">{app.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(app.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Review Actions */}
      {isPending && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-medium">{t.review.title}</h3>

            <div className="space-y-2">
              <Label>{t.review.note}</Label>
              <Textarea
                placeholder={t.review.notePlaceholder}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="banUsers"
                checked={banUsers}
                onCheckedChange={(checked) => setBanUsers(checked === true)}
              />
              <div>
                <Label htmlFor="banUsers" className="cursor-pointer">
                  {t.review.banUsers}
                </Label>
                <p className="text-xs text-muted-foreground">{t.review.banUsersDesc}</p>
              </div>
            </div>

            {banUsers && (
              <div className="space-y-2 pl-6">
                <Label>{t.review.banReason}</Label>
                <Input
                  placeholder={t.review.banReasonPlaceholder}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={() => handleReview("CONFIRMED")}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                {t.review.confirm}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReview("CLEARED")}
                disabled={submitting}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {t.review.clear}
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleReview("IGNORED")}
                disabled={submitting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                {t.review.ignore}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Review History */}
      {!isPending && data.reviewedAt && (
        <>
          <Separator />
          <div className="text-sm">
            <div className="text-muted-foreground mb-2">
              {locale === "zh" ? "处理记录" : "Review History"}
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline">{getStatusLabel(data.status)}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(data.reviewedAt)}
                </span>
              </div>
              {data.reviewedBy && (
                <div className="text-xs text-muted-foreground">
                  {locale === "zh" ? "处理人：" : "Reviewed by: "}
                  {data.reviewedBy.name || data.reviewedBy.email}
                </div>
              )}
              {data.reviewNote && <div className="mt-2 text-sm">{data.reviewNote}</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
