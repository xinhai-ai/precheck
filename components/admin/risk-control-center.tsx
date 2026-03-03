"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { motion } from "framer-motion"
import {
  ShieldAlert,
  Shield,
  Loader2,
  RefreshCw,
  Search,
  Copy,
  MoreHorizontal,
  Ban,
  ShieldCheck,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Role } from "@prisma/client"
import type {
  FingerprintRiskGroupDetailResponse,
  FingerprintRiskGroupItem,
} from "@/lib/risk-control/fingerprint-risk"
import { maskFingerprintHash } from "@/lib/risk-control/fingerprint-risk"

interface AdminRiskControlCenterProps {
  locale: Locale
  dict: Dictionary
  currentRole: Role
}

type RiskLevelFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW"

type IgnoredUserItem = {
  id: string
  userId: string
  reason: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    name: string | null
    email: string
    role: string
    status: string
  }
  createdBy: {
    id: string
    name: string | null
    email: string
  }
}

type GroupListResponse = {
  items: FingerprintRiskGroupItem[]
  total: number
  page: number
  limit: number
  stats: {
    high: number
    medium: number
    ignoredUsers: number
  }
}

const DEFAULT_LIMIT = 20

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return "-"
  return new Date(value).toLocaleString(locale)
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color = "primary",
  active = false,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  trend?: string
  color?: "primary" | "success" | "warning" | "danger" | "purple"
  active?: boolean
  onClick?: () => void
}) {
  const colorStyles = {
    primary: "from-primary/20 to-primary/5 text-primary",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400",
    danger: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400",
    purple: "from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border bg-card p-4 ${
        onClick ? "cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md" : ""
      } ${active ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br opacity-50 ${colorStyles[color]}`} />
      <div className="relative flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colorStyles[color]}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && <p className="text-xs text-muted-foreground">{trend}</p>}
        </div>
      </div>
    </motion.div>
  )
}

export function AdminRiskControlCenter({ locale, dict, currentRole }: AdminRiskControlCenterProps) {
  const router = useRouter()
  const t = dict.admin as unknown as Record<string, unknown>
  const riskT = ((t.riskControlPanel as Record<string, unknown>) || {}) as Record<string, string>
  const isSuperAdmin = currentRole === "SUPER_ADMIN"

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<FingerprintRiskGroupItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(DEFAULT_LIMIT)
  const [stats, setStats] = useState({ high: 0, medium: 0, ignoredUsers: 0 })
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [riskLevel, setRiskLevel] = useState<RiskLevelFilter>("ALL")
  const [sortBy, setSortBy] = useState<"lastSeenAt" | "userCount" | "applicationCount">("lastSeenAt")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<FingerprintRiskGroupDetailResponse | null>(null)

  const [ignoredLoading, setIgnoredLoading] = useState(false)
  const [ignoredItems, setIgnoredItems] = useState<IgnoredUserItem[]>([])
  const [ignoreTarget, setIgnoreTarget] = useState<{ id: string; label: string } | null>(null)
  const [ignoreReason, setIgnoreReason] = useState("")
  const [savingIgnore, setSavingIgnore] = useState(false)

  const ignoredUserIdSet = useMemo(() => new Set(ignoredItems.map((item) => item.userId)), [ignoredItems])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const loadGroups = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      })
      if (search) params.set("search", search)
      if (riskLevel !== "ALL") params.set("riskLevel", riskLevel)

      const res = await fetch(`/api/admin/risk-control/fingerprint-groups?${params.toString()}`)
      if (!res.ok) {
        throw new Error(riskT.loadFailed || "加载风险分组失败")
      }

      const data: GroupListResponse = await res.json()
      setItems(data.items || [])
      setTotal(data.total || 0)
      setStats(
        data.stats || {
          high: 0,
          medium: 0,
          ignoredUsers: 0,
        },
      )
    } catch (error) {
      console.error("Risk groups fetch error:", error)
      toast.error(error instanceof Error ? error.message : riskT.loadFailed || "加载失败")
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const loadIgnoredUsers = async () => {
    setIgnoredLoading(true)
    try {
      const res = await fetch("/api/admin/risk-control/ignored-users")
      if (!res.ok) {
        throw new Error(riskT.ignoredLoadFailed || "加载忽略用户失败")
      }
      const data = await res.json()
      setIgnoredItems(data.items || [])
    } catch (error) {
      console.error("Ignored users fetch error:", error)
      toast.error(error instanceof Error ? error.message : riskT.ignoredLoadFailed || "加载失败")
      setIgnoredItems([])
    } finally {
      setIgnoredLoading(false)
    }
  }

  const loadDetail = async (fingerprintHash: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(
        `/api/admin/risk-control/fingerprint-groups/${encodeURIComponent(fingerprintHash)}`,
      )
      if (!res.ok) {
        throw new Error(riskT.detailLoadFailed || "加载详情失败")
      }
      const data: FingerprintRiskGroupDetailResponse = await res.json()
      setDetail(data)
    } catch (error) {
      console.error("Risk detail fetch error:", error)
      toast.error(error instanceof Error ? error.message : riskT.detailLoadFailed || "加载失败")
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [page, limit, search, riskLevel, sortBy, sortOrder])

  useEffect(() => {
    loadIgnoredUsers()
  }, [])

  useEffect(() => {
    if (selectedHash) {
      loadDetail(selectedHash)
    }
  }, [selectedHash])

  const handleSearchApply = () => {
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleRefresh = async () => {
    await Promise.all([loadGroups(), loadIgnoredUsers(), selectedHash ? loadDetail(selectedHash) : null])
  }

  const handleIgnoreSubmit = async () => {
    if (!ignoreTarget) return
    const reason = ignoreReason.trim()
    if (reason.length < 5) {
      toast.error(riskT.reasonTooShort || "忽略原因至少 5 个字符")
      return
    }

    setSavingIgnore(true)
    try {
      const res = await fetch("/api/admin/risk-control/ignored-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: ignoreTarget.id,
          reason,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message || riskT.ignoredSaveFailed || "忽略失败")
      }

      toast.success(riskT.ignoredSaveSuccess || "已忽略该用户风险")
      setIgnoreTarget(null)
      setIgnoreReason("")
      await Promise.all([loadGroups(), loadIgnoredUsers(), selectedHash ? loadDetail(selectedHash) : null])
    } catch (error) {
      console.error("Ignore user save error:", error)
      toast.error(error instanceof Error ? error.message : riskT.ignoredSaveFailed || "操作失败")
    } finally {
      setSavingIgnore(false)
    }
  }

  const handleUnignore = async (userId: string) => {
    if (!window.confirm(riskT.ignoredDeleteConfirm || "确认取消忽略该用户？")) return

    try {
      const res = await fetch(`/api/admin/risk-control/ignored-users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message || riskT.ignoredDeleteFailed || "取消忽略失败")
      }

      toast.success(riskT.ignoredDeleteSuccess || "已取消忽略")
      await Promise.all([loadGroups(), loadIgnoredUsers(), selectedHash ? loadDetail(selectedHash) : null])
    } catch (error) {
      console.error("Unignore user error:", error)
      toast.error(error instanceof Error ? error.message : riskT.ignoredDeleteFailed || "操作失败")
    }
  }

  const handleToggleUserBan = async (userId: string, isBanned: boolean) => {
    if (!isSuperAdmin) {
      toast.error(riskT.actionForbidden || "仅超级管理员可执行该操作")
      return
    }

    try {
      const nextStatus = isBanned ? "ACTIVE" : "BANNED"
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message =
          (data?.error?.message as string | undefined) ||
          (data?.error?.code as string | undefined) ||
          (isBanned ? riskT.unbanFailed : riskT.banFailed) ||
          "操作失败"
        throw new Error(message)
      }

      toast.success(isBanned ? riskT.unbanSuccess || "已解封用户" : riskT.banSuccess || "已封禁用户")
      await Promise.all([loadGroups(), loadIgnoredUsers(), selectedHash ? loadDetail(selectedHash) : null])
    } catch (error) {
      console.error("Toggle user ban status error:", error)
      toast.error(error instanceof Error ? error.message : riskT.banFailed || "操作失败")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-lg shadow-rose-500/25">
          <ShieldAlert className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {riskT.title || "风险控制中心"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {riskT.description || "集中查看指纹关联风险，支持忽略特定用户以降低误报。"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={ShieldAlert}
          label={riskT.highRisk || "高风险分组"}
          value={stats.high}
          color="danger"
          active={riskLevel === "HIGH"}
          onClick={() => {
            setRiskLevel("HIGH")
            setPage(1)
          }}
        />
        <StatCard
          icon={Shield}
          label={riskT.mediumRisk || "中风险分组"}
          value={stats.medium}
          color="warning"
          active={riskLevel === "MEDIUM"}
          onClick={() => {
            setRiskLevel("MEDIUM")
            setPage(1)
          }}
        />
        <StatCard
          icon={ShieldCheck}
          label={riskT.ignoredUsers || "已忽略用户"}
          value={stats.ignoredUsers}
          color="primary"
          onClick={() => {
            setRiskLevel("ALL")
            setPage(1)
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{riskT.groupList || "风险分组"}</CardTitle>
          <CardDescription>
            {riskT.groupListDesc || "基于指纹事件聚合，默认展示同指纹多账号或多申请记录。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2 flex gap-2">
              <Input
                placeholder={riskT.searchPlaceholder || "搜索指纹哈希或邮箱"}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearchApply()
                  }
                }}
              />
              <Button variant="outline" onClick={handleSearchApply}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select
              value={riskLevel}
              onValueChange={(value: RiskLevelFilter) => {
                setRiskLevel(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={riskT.riskLevel || "风险等级"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{riskT.allLevels || "全部等级"}</SelectItem>
                <SelectItem value="HIGH">{riskT.levelHigh || "高风险"}</SelectItem>
                <SelectItem value="MEDIUM">{riskT.levelMedium || "中风险"}</SelectItem>
                <SelectItem value="LOW">{riskT.levelLow || "低风险"}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(value: "lastSeenAt" | "userCount" | "applicationCount") => {
                setSortBy(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastSeenAt">{riskT.sortLastSeen || "按最近出现"}</SelectItem>
                <SelectItem value="userCount">{riskT.sortUsers || "按用户数"}</SelectItem>
                <SelectItem value="applicationCount">{riskT.sortApplications || "按申请数"}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sortOrder}
              onValueChange={(value: "desc" | "asc") => {
                setSortOrder(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{riskT.sortDesc || "降序"}</SelectItem>
                <SelectItem value="asc">{riskT.sortAsc || "升序"}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {riskT.refresh || "刷新"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{riskT.fingerprintHash || "指纹哈希"}</th>
                  <th className="px-3 py-2 text-left font-medium">{riskT.userCount || "用户数"}</th>
                  <th className="px-3 py-2 text-left font-medium">
                    {riskT.applicationCount || "申请数"}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{riskT.lastSeenAt || "最近出现"}</th>
                  <th className="px-3 py-2 text-left font-medium">{riskT.riskLevel || "风险等级"}</th>
                  <th className="px-3 py-2 text-right font-medium">{t.actions as string}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.loading as string}
                      </span>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {riskT.empty || "暂无风险分组"}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.fingerprintHash} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{maskFingerprintHash(item.fingerprintHash)}</span>
                          <button
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(item.fingerprintHash)
                              toast.success(riskT.copied || "已复制")
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">{item.userCount}</td>
                      <td className="px-3 py-2">{item.applicationCount}</td>
                      <td className="px-3 py-2">{formatDateTime(item.lastSeenAt, locale)}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={item.riskLevel === "HIGH" ? "destructive" : "secondary"}
                          className={
                            item.riskLevel === "MEDIUM"
                              ? "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : item.riskLevel === "LOW"
                                ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                : ""
                          }
                        >
                          {item.riskLevel === "HIGH"
                            ? riskT.levelHigh || "高风险"
                            : item.riskLevel === "MEDIUM"
                              ? riskT.levelMedium || "中风险"
                              : riskT.levelLow || "低风险"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedHash(item.fingerprintHash)}
                        >
                          {riskT.viewDetail || "查看详情"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {riskT.total || "总数"}: {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                {riskT.prev || "上一页"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {page}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                {riskT.next || "下一页"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Drawer
        open={Boolean(selectedHash)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHash(null)
            setDetail(null)
          }
        }}
        direction="right"
      >
        <DrawerContent className="h-full data-[vaul-drawer-direction=right]:w-[95vw] data-[vaul-drawer-direction=right]:sm:max-w-2xl">
          <DrawerHeader className="sticky top-0 z-10 border-b bg-background">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DrawerTitle>{riskT.detailTitle || "风险详情"}</DrawerTitle>
                <DrawerDescription className="font-mono text-xs break-all">
                  {selectedHash || "-"}
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {detailLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.loading as string}
                </span>
              </div>
            ) : !detail ? (
              <p className="text-sm text-muted-foreground">{riskT.detailEmpty || "暂无详情"}</p>
            ) : (
              <>
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{riskT.userCount || "用户数"}</CardDescription>
                      <CardTitle className="text-lg">{detail.summary.userCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{riskT.applicationCount || "申请数"}</CardDescription>
                      <CardTitle className="text-lg">{detail.summary.applicationCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{riskT.lastSeenAt || "最近出现"}</CardDescription>
                      <CardTitle className="text-sm">
                        {formatDateTime(detail.summary.lastSeenAt, locale)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>{riskT.ignoredImpact || "忽略影响"}</CardDescription>
                      <CardTitle className="text-lg">{detail.ignoredImpact}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{riskT.relatedUsers || "关联用户"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.relatedUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {riskT.emptyRelatedUsers || "暂无关联用户"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.relatedUsers.map((item) => {
                          const isIgnored = ignoredUserIdSet.has(item.id)
                          const isBanned = item.status === "BANNED"

                          return (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 rounded-md border p-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{item.name || item.email}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  {riskT.relatedTime || "关联时间"}:{" "}
                                  {formatDateTime(item.firstSeenAt, locale)} →{" "}
                                  {formatDateTime(item.lastSeenAt, locale)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  IP: {item.lastSeenIp || "-"}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.role}
                                  </Badge>
                                  <Badge
                                    variant={isBanned ? "destructive" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {item.status}
                                  </Badge>
                                  {isIgnored && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {riskT.ignoredTag || "已忽略"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    disabled={!isSuperAdmin}
                                    onClick={() => {
                                      if (isIgnored) {
                                        void handleUnignore(item.id)
                                      } else {
                                        setIgnoreTarget({
                                          id: item.id,
                                          label: item.name || item.email,
                                        })
                                      }
                                    }}
                                  >
                                    {isIgnored ? (
                                      <ShieldCheck className="mr-2 h-4 w-4" />
                                    ) : (
                                      <ShieldAlert className="mr-2 h-4 w-4" />
                                    )}
                                    {isIgnored
                                      ? riskT.unignoreUser || "取消忽略"
                                      : riskT.ignoreUser || "忽略用户"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!isSuperAdmin}
                                    onClick={() => void handleToggleUserBan(item.id, isBanned)}
                                  >
                                    {isBanned ? (
                                      <ShieldCheck className="mr-2 h-4 w-4" />
                                    ) : (
                                      <Ban className="mr-2 h-4 w-4" />
                                    )}
                                    {isBanned
                                      ? riskT.unbanUser || "解封用户"
                                      : riskT.banUser || "封禁用户"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(
                                        `/${locale}/admin/users?search=${encodeURIComponent(item.email)}`,
                                      )
                                    }
                                  >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    {riskT.openUserManagement || "打开用户管理"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {riskT.relatedApplications || "关联申请"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.relatedApplications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {riskT.emptyRelatedApplications || "暂无关联申请"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {detail.relatedApplications.map((item) => (
                          <div key={item.id} className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium">
                                {item.user?.name || item.user?.email || item.registerEmail}
                              </p>
                              <span className="text-muted-foreground">{item.status}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateTime(item.createdAt, locale)}
                            </p>
                            <div className="rounded bg-background p-2">
                              <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                                {riskT.applicationEssay || "小作文"}
                              </p>
                              <p className="whitespace-pre-wrap break-words text-[11px]">
                                {item.essay || "-"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{riskT.recentEvents || "最近事件"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.recentEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{riskT.emptyEvents || "暂无事件"}</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.recentEvents.map((item) => (
                          <div key={item.id} className="rounded-md border p-2 text-xs">
                            <p className="font-medium">
                              {item.eventType} · {item.status}
                            </p>
                            <p className="text-muted-foreground">
                              {formatDateTime(item.createdAt, locale)} · {item.ip || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Card>
        <CardHeader>
          <CardTitle>{riskT.ignoredList || "已忽略用户"}</CardTitle>
          <CardDescription>
            {riskT.ignoredListDesc || "全局忽略后，该用户将不再参与任何指纹风险聚合。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ignoredLoading ? (
            <p className="text-sm text-muted-foreground">{t.loading as string}</p>
          ) : ignoredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{riskT.ignoredEmpty || "暂无忽略记录"}</p>
          ) : (
            <div className="space-y-2">
              {ignoredItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.user.name || item.user.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.reason}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {riskT.by || "由"} {item.createdBy.name || item.createdBy.email} ·{" "}
                      {formatDateTime(item.createdAt, locale)}
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <Button size="sm" variant="outline" onClick={() => handleUnignore(item.userId)}>
                      {riskT.unignoreUser || "取消忽略"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(ignoreTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setIgnoreTarget(null)
            setIgnoreReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{riskT.ignoreUser || "忽略用户风险"}</DialogTitle>
            <DialogDescription>
              {riskT.ignoreUserHint || "请填写忽略原因，至少 5 个字符。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{riskT.reason || "原因"}</Label>
            <Input
              value={ignoreReason}
              onChange={(event) => setIgnoreReason(event.target.value)}
              placeholder={riskT.reasonPlaceholder || "例如：测试账号、内部巡检账号"}
            />
            <p className="text-xs text-muted-foreground">
              {(riskT.targetUser || "目标用户")}: {ignoreTarget?.label}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreTarget(null)}>
              {t.cancel as string}
            </Button>
            <Button onClick={handleIgnoreSubmit} disabled={savingIgnore}>
              {savingIgnore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {riskT.confirmIgnore || "确认忽略"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
