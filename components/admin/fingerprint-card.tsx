"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Fingerprint,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Monitor,
  Globe,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getRiskLevel, RISK_LEVEL_COLORS } from "@/lib/fingerprint/constants"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"

interface FingerprintUser {
  id: string
  email: string
  name?: string | null
  createdAt: string | Date
}

interface FingerprintCardProps {
  locale: Locale
  dict: Dictionary
  fingerprint: {
    id: string
    visitorId: string
    browser?: string | null
    os?: string | null
    device?: string | null
    screenResolution?: string | null
    timezone?: string | null
    firstSeenAt: string | Date
    lastSeenAt: string | Date
  } | null
  link?: {
    id: string
    riskScore: number
    status: string
    userIds: string[]
  } | null
  linkedUsers?: FingerprintUser[]
  currentUserId?: string
  className?: string
}

export function FingerprintCard({
  locale,
  dict,
  fingerprint,
  link,
  linkedUsers = [],
  currentUserId,
  className,
}: FingerprintCardProps) {
  const t = dict.admin.fingerprint
  const [copied, setCopied] = useState(false)

  if (!fingerprint) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4" />
            {t.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.noFingerprint}</p>
        </CardContent>
      </Card>
    )
  }

  const riskScore = link?.riskScore ?? 0
  const riskLevel = getRiskLevel(riskScore)
  const riskColor = RISK_LEVEL_COLORS[riskLevel]
  const riskLabel = t.riskLevel[riskLevel]
  const linkedCount = link?.userIds?.length ?? 1
  const hasMultipleAccounts = linkedCount > 1

  const handleCopyVisitorId = async () => {
    await navigator.clipboard.writeText(fingerprint.visitorId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const otherUsers = linkedUsers.filter((u) => u.id !== currentUserId)

  return (
    <Card
      className={cn(
        hasMultipleAccounts && riskLevel === "high" && "border-red-500/50",
        hasMultipleAccounts && riskLevel === "medium" && "border-yellow-500/50",
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Fingerprint className="h-4 w-4" />
            {t.title}
          </CardTitle>
          {hasMultipleAccounts && (
            <Badge
              variant="outline"
              className={cn(
                riskColor === "red" && "border-red-500 text-red-500",
                riskColor === "yellow" && "border-yellow-500 text-yellow-500",
                riskColor === "green" && "border-green-500 text-green-500",
              )}
            >
              {riskLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 指纹 ID */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t.visitorId}</span>
          <div className="flex items-center gap-1">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {fingerprint.visitorId.substring(0, 12)}...
            </code>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopyVisitorId}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? t.copied : t.copy}</TooltipContent>
            </Tooltip>
            {link && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                    <Link href={`/${locale}/admin/fingerprints?id=${link.id}`}>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.viewDetails}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 关联账号数 */}
        {hasMultipleAccounts && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t.linkedAccounts}</span>
            <span className="text-sm font-medium">{linkedCount}</span>
          </div>
        )}

        {/* 设备信息 */}
        <div className="border-t pt-2 space-y-1.5">
          {fingerprint.browser && (
            <div className="flex items-center gap-2 text-xs">
              <Monitor className="h-3 w-3 text-muted-foreground" />
              <span>
                {fingerprint.browser}
                {fingerprint.os && ` / ${fingerprint.os}`}
              </span>
            </div>
          )}
          {fingerprint.screenResolution && (
            <div className="flex items-center gap-2 text-xs">
              <Monitor className="h-3 w-3 text-muted-foreground" />
              <span>{fingerprint.screenResolution}</span>
            </div>
          )}
          {fingerprint.timezone && (
            <div className="flex items-center gap-2 text-xs">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span>{fingerprint.timezone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDate(fingerprint.lastSeenAt)}</span>
          </div>
        </div>

        {/* 多账号警告 */}
        {hasMultipleAccounts && otherUsers.length > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500 mb-2">
              <AlertTriangle className="h-3 w-3" />
              <span>
                {t.multiAccountWarning.replace("{count}", String(linkedCount - 1))}
              </span>
            </div>
            <div className="space-y-1">
              {otherUsers.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground truncate max-w-[150px]">
                    {user.email}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </span>
                </div>
              ))}
              {otherUsers.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  {t.andMore.replace("{count}", String(otherUsers.length - 3))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
