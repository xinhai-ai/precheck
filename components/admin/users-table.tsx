"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Search,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle2,
  Trash2,
  XCircle,
  X,
  Users,
  UserPlus,
  Loader2,
  Globe,
  Crown,
  Key,
  Download,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { DataTable, type Column } from "@/components/ui/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"

// 统计卡片组件
function StatCard({
  icon: Icon,
  label,
  value,
  color = "primary",
  active = false,
  onClick,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: "primary" | "success" | "warning" | "danger"
  active?: boolean
  onClick?: () => void
}) {
  const colorStyles = {
    primary: "from-primary/20 to-primary/5 text-primary",
    success: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    warning: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400",
    danger: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400",
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
        </div>
      </div>
    </motion.div>
  )
}

interface AdminUser {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  createdAt: string
  applicationCount: number
  reviewCount: number
  latestFingerprintHash?: string | null
  latestFingerprintAt?: string | null
  banReason?: string | null
  preApplicationSubmitBannedUntil?: string | null
  preApplicationReapplyEligibleAt?: string | null
  preApplicationReapplyStartedAt?: string | null
  latestPreApplicationStatus?: string | null
  latestPreApplicationId?: string | null
  shadowBanned?: boolean
  shadowBanReason?: string | null
  shadowBannedAt?: string | null
  hasLinuxdoAccount?: boolean
}

interface LinuxdoAccountProfile {
  id: string
  email: string | null
  name: string | null
  username: string | null
  avatar_url: string | null
  trust_level: number | null
}

interface AdminUserDetail extends AdminUser {
  updatedAt?: string
  linuxdoAccount?: {
    providerAccountId: string
    trustLevel: number | null
    providerProfile: LinuxdoAccountProfile | null
  } | null
}

interface AdminUsersTableProps {
  locale: Locale
  dict: Dictionary
}

export function AdminUsersTable({ locale, dict }: AdminUsersTableProps) {
  const t = dict.admin
  const adminExt = t as unknown as Record<string, string>
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    active: 0,
    banned: 0,
    linuxdo: 0,
    linuxdoTL3Admins: 0,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [fingerprintHashFilter, setFingerprintHashFilter] = useState("")
  const [fingerprintHashInput, setFingerprintHashInput] = useState("")
  const [sortBy, setSortBy] = useState("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [linuxdoTL3Filter, setLinuxdoTL3Filter] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    title: string
    description: string
    confirmLabel: string
    destructive?: boolean
    onConfirm: () => Promise<void>
  } | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [linuxdoDetailOpen, setLinuxdoDetailOpen] = useState(false)
  const [linuxdoDetailLoading, setLinuxdoDetailLoading] = useState(false)
  const [selectedLinuxdoUser, setSelectedLinuxdoUser] = useState<AdminUserDetail | null>(null)
  const [emailsInput, setEmailsInput] = useState("")
  const [creating, setCreating] = useState(false)
  const [exporting, setExporting] = useState(false)

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setCurrentUserRole(data.user?.role || null)
        setCurrentUserId(data.user?.id || null)
      }
    } catch {
      // ignore
    }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError("")
    setSelectedIds(new Set())
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(fingerprintHashFilter && { fingerprintHash: fingerprintHashFilter }),
        ...(roleFilter !== "all" && { role: roleFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(providerFilter !== "all" && { provider: providerFilter }),
        ...(linuxdoTL3Filter && { linuxdoTL3: "true" }),
      })
      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) {
        throw new Error("Fetch failed")
      }
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.total || 0)
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (fetchError) {
      console.error("Admin users fetch error:", fetchError)
      setError(t.fetchFailed)
    } finally {
      setLoading(false)
    }
  }, [
    fingerprintHashFilter,
    linuxdoTL3Filter,
    page,
    pageSize,
    providerFilter,
    roleFilter,
    search,
    sortBy,
    sortOrder,
    statusFilter,
    t.fetchFailed,
  ])

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const handleSearch = () => {
    setSearch(searchInput)
    setFingerprintHashFilter(fingerprintHashInput)
    setPage(1)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      handleSearch()
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(fingerprintHashFilter && { fingerprintHash: fingerprintHashFilter }),
        ...(roleFilter !== "all" && { role: roleFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(providerFilter !== "all" && { provider: providerFilter }),
        ...(linuxdoTL3Filter && { linuxdoTL3: "true" }),
      })
      const res = await fetch(`/api/admin/users/export?${params}`)
      if (!res.ok) {
        throw new Error("Export failed")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(adminExt.exportSuccess || "导出成功")
    } catch (error) {
      console.error("Admin users export error:", error)
      toast.error(adminExt.exportFailed || t.actionFailed)
    } finally {
      setExporting(false)
    }
  }

  const formatPageSummary = (summary: { total: number; page: number; totalPages: number }) =>
    t.pageSummary
      .replace("{total}", summary.total.toString())
      .replace("{page}", summary.page.toString())
      .replace("{totalPages}", summary.totalPages.toString())

  const updateUser = async (
    id: string,
    payload: {
      role?: string
      status?: string
      banReason?: string | null
      preApplicationSubmitBanDays?: number | null
    },
  ) => {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error("Update failed")
      }
      await fetchUsers()
    } catch (updateError) {
      console.error("Admin user update error:", updateError)
      setError(t.actionFailed)
    } finally {
      setBusyId(null)
    }
  }

  const deleteUser = async (id: string) => {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("Delete failed")
      }
      await fetchUsers()
    } catch (deleteError) {
      console.error("Admin user delete error:", deleteError)
      setError(t.actionFailed)
    } finally {
      setBusyId(null)
    }
  }

  const hardDeleteUser = async (id: string) => {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/admin/users/${id}?hard=true`, {
        method: "DELETE",
      })
      if (!res.ok) {
        throw new Error("Hard delete failed")
      }
      toast.success(t.hardDeleteSuccess || "用户已彻底删除")
      await fetchUsers()
    } catch (deleteError) {
      console.error("Admin user hard delete error:", deleteError)
      setError(t.actionFailed)
    } finally {
      setBusyId(null)
    }
  }

  const resetUserPreApplicationReapply = async (id: string) => {
    setBusyId(id)
    setError("")
    try {
      const res = await fetch(`/api/admin/users/${id}/reapply`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = resolveApiErrorMessage(data, dict) ?? t.actionFailed
        throw new Error(message)
      }
      toast.success(adminExt.preApplicationReapplyResetSuccess || "已允许该用户重新发起新一轮申请")
      await fetchUsers()
    } catch (resetError) {
      console.error("Admin reset pre-application reapply error:", resetError)
      setError(resetError instanceof Error ? resetError.message : t.actionFailed)
    } finally {
      setBusyId(null)
    }
  }

  const batchUpdateRole = async (role: "ADMIN" | "USER") => {
    if (selectedIds.size === 0) return
    setBatchBusy(true)
    setError("")
    try {
      const res = await fetch("/api/admin/users/batch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedIds), role }),
      })
      if (!res.ok) throw new Error("Batch update failed")
      const data = await res.json()
      toast.success(
        (t.batchRoleSuccess || "已更新 {count} 个用户角色").replace(
          "{count}",
          String(data.updated),
        ),
      )
      setSelectedIds(new Set())
      await fetchUsers()
    } catch {
      setError(t.actionFailed)
    } finally {
      setBatchBusy(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)))
    }
  }

  const handleCreateUsers = async () => {
    const emails = emailsInput
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

    if (emails.length === 0) {
      toast.error(t.createUserInvalidEmails || "请输入有效的邮箱地址")
      return
    }

    setCreating(true)
    try {
      const res = await fetch("/api/admin/users/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = resolveApiErrorMessage(data, dict) ?? t.actionFailed
        throw new Error(message)
      }

      const result = await res.json()
      toast.success(
        (t.createUserSuccess || "已创建 {created} 个用户，跳过 {skipped} 个已存在")
          .replace("{created}", String(result.created))
          .replace("{skipped}", String(result.skipped)),
      )
      setCreateDialogOpen(false)
      setEmailsInput("")
      await fetchUsers()
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : t.actionFailed)
    } finally {
      setCreating(false)
    }
  }

  const fetchLinuxdoUserDetail = async (id: string) => {
    setLinuxdoDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      if (!res.ok) {
        throw new Error("Fetch detail failed")
      }

      const data = (await res.json()) as AdminUserDetail
      setSelectedLinuxdoUser(data)
      setLinuxdoDetailOpen(true)
    } catch (detailError) {
      console.error("Admin linuxdo detail fetch error:", detailError)
      toast.error(adminExt.linuxdoInfoLoadFailed || t.actionFailed)
    } finally {
      setLinuxdoDetailLoading(false)
    }
  }

  const renderRoleBadge = (role: string) => {
    const roleStyles: Record<string, string> = {
      SUPER_ADMIN: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      ADMIN: "bg-destructive/10 text-destructive",
      USER: "bg-muted text-muted-foreground",
    }
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${roleStyles[role] || roleStyles.USER}`}
      >
        {role}
      </span>
    )
  }

  const renderStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      ACTIVE: t.active,
      INACTIVE: t.inactive,
      BANNED: t.banned,
      DELETED: t.deleted || "已删除",
    }
    const statusStyles: Record<string, string> = {
      ACTIVE: "bg-primary/10 text-primary",
      DELETED: "bg-muted text-muted-foreground line-through",
    }
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          statusStyles[status] || "bg-destructive/10 text-destructive"
        }`}
      >
        {statusMap[status] || status}
      </span>
    )
  }

  const isSubmitBanActive = (bannedUntil?: string | null) => {
    if (!bannedUntil) return false
    const ms = new Date(bannedUntil).getTime()
    return Number.isFinite(ms) && ms > Date.now()
  }

  const renderActions = (user: AdminUser) => {
    const isBusy = busyId === user.id
    const isSuperAdmin = currentUserRole === "SUPER_ADMIN"
    const canPromote = user.role === "USER" && isSuperAdmin
    const canDemote = user.role === "ADMIN" && isSuperAdmin
    const isSubmitBanned = isSubmitBanActive(user.preApplicationSubmitBannedUntil)
    const canResetPreApplicationReapply =
      isSuperAdmin &&
      user.id !== currentUserId &&
      user.role !== "SUPER_ADMIN" &&
      user.latestPreApplicationStatus === "APPROVED" &&
      !user.preApplicationReapplyEligibleAt
    const shouldActivate = user.status !== "ACTIVE"
    const statusLabel = shouldActivate ? t.activate : t.ban

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isBusy}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isSuperAdmin && user.hasLinuxdoAccount && (
            <DropdownMenuItem
              disabled={isBusy || linuxdoDetailLoading}
              onClick={() => {
                void fetchLinuxdoUserDetail(user.id)
              }}
            >
              <Globe className="mr-2 h-4 w-4" />
              {adminExt.viewLinuxdoInfo || "查看 Linux.do 信息"}
            </DropdownMenuItem>
          )}
          {isSuperAdmin && user.id !== currentUserId && user.role !== "SUPER_ADMIN" && (
            <DropdownMenuItem
              disabled={isBusy}
              onClick={async () => {
                setBusyId(user.id)
                try {
                  if (user.shadowBanned) {
                    const confirmed = window.confirm(
                      adminExt.unshadowbanConfirm || "确认解除该用户 Shadowban？",
                    )
                    if (!confirmed) return
                    const res = await fetch(
                      `/api/admin/shadow-banned-users/${encodeURIComponent(user.id)}`,
                      { method: "DELETE" },
                    )
                    if (!res.ok) throw new Error("Unshadowban failed")
                    toast.success(adminExt.unshadowbanSuccess || "已解除 Shadowban")
                  } else {
                    const reason = window.prompt(
                      adminExt.shadowbanReasonPrompt || "请输入 Shadowban 原因：",
                      "",
                    )
                    if (!reason?.trim()) return
                    const res = await fetch("/api/admin/shadow-banned-users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ userId: user.id, reason: reason.trim() }),
                    })
                    if (!res.ok) throw new Error("Shadowban failed")
                    toast.success(adminExt.shadowbanSuccess || "已设置 Shadowban")
                  }
                  await fetchUsers()
                } catch (error) {
                  console.error("Toggle shadowban error:", error)
                  toast.error(t.actionFailed)
                } finally {
                  setBusyId(null)
                }
              }}
            >
              <Key className="mr-2 h-4 w-4" />
              {user.shadowBanned
                ? adminExt.unshadowbanUser || "解除 Shadowban"
                : adminExt.shadowbanUser || "Shadowban 用户"}
            </DropdownMenuItem>
          )}
          {isSuperAdmin && user.role !== "SUPER_ADMIN" && (
            <>
              {canResetPreApplicationReapply && (
                <DropdownMenuItem
                  disabled={isBusy}
                  onClick={() => {
                    setConfirmState({
                      title: adminExt.preApplicationReapplyResetTitle || "允许重新申请",
                      description:
                        adminExt.preApplicationReapplyResetDescription ||
                        "此操作会将该用户最新一条已通过申请归档为历史记录，并允许其手动开始新一轮申请。",
                      confirmLabel: adminExt.preApplicationReapplyResetAction || "允许重新申请",
                      onConfirm: async () => {
                        await resetUserPreApplicationReapply(user.id)
                      },
                    })
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {adminExt.preApplicationReapplyResetAction || "允许重新申请"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                disabled={isBusy}
                onClick={() => {
                  if (isSubmitBanned) {
                    setConfirmState({
                      title: t.confirmTitle,
                      description: adminExt.confirmSubmitUnbanUser || "确定解除该用户的提交封禁？",
                      confirmLabel: adminExt.submitUnbanUser || "解除提交封禁",
                      onConfirm: async () => {
                        await updateUser(user.id, { preApplicationSubmitBanDays: null })
                      },
                    })
                    return
                  }

                  const input = window.prompt(
                    adminExt.submitBanDaysPrompt || "请输入提交封禁天数（正整数）：",
                    "1",
                  )
                  if (input === null) return

                  const days = Number.parseInt(input.trim(), 10)
                  if (!Number.isInteger(days) || days < 1 || days > 3650) {
                    toast.error(adminExt.submitBanDaysInvalid || "请输入 1-3650 的整数天数")
                    return
                  }

                  void updateUser(user.id, { preApplicationSubmitBanDays: days })
                }}
              >
                {isSubmitBanned ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <Ban className="mr-2 h-4 w-4" />
                )}
                {isSubmitBanned
                  ? adminExt.submitUnbanUser || "解除提交封禁"
                  : adminExt.submitBanUser || "封禁提交权限"}
              </DropdownMenuItem>
              {canPromote && (
                <DropdownMenuItem
                  disabled={isBusy}
                  onClick={() => {
                    setConfirmState({
                      title: t.confirmTitle,
                      description: t.confirmMakeAdmin,
                      confirmLabel: t.makeAdmin,
                      onConfirm: async () => {
                        await updateUser(user.id, { role: "ADMIN" })
                      },
                    })
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {t.makeAdmin}
                </DropdownMenuItem>
              )}
              {canDemote && (
                <DropdownMenuItem
                  disabled={isBusy}
                  onClick={() => {
                    setConfirmState({
                      title: t.confirmTitle,
                      description: t.confirmRemoveAdmin,
                      confirmLabel: t.removeAdmin,
                      onConfirm: async () => {
                        await updateUser(user.id, { role: "USER" })
                      },
                    })
                  }}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  {t.removeAdmin}
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuItem
            disabled={isBusy}
            onClick={() => {
              const isBanning = !shouldActivate
              setConfirmState({
                title: t.confirmTitle,
                description: shouldActivate ? t.confirmActivateUser : t.confirmBanUser,
                confirmLabel: statusLabel,
                onConfirm: async () => {
                  if (isBanning) {
                    const reason = window.prompt(
                      adminExt.banReasonPrompt || "请输入封禁理由（可选）：",
                      user.banReason || "",
                    )
                    if (reason === null) return
                    await updateUser(user.id, {
                      status: "BANNED",
                      banReason: reason.trim() || null,
                    })
                    return
                  }

                  await updateUser(user.id, { status: "ACTIVE", banReason: null })
                },
              })
            }}
          >
            {shouldActivate ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            {statusLabel}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            disabled={isBusy}
            onClick={() => {
              setConfirmState({
                title: t.confirmTitle,
                description: t.confirmDeleteUser,
                confirmLabel: t.delete,
                destructive: true,
                onConfirm: async () => {
                  await deleteUser(user.id)
                },
              })
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t.delete}
          </DropdownMenuItem>
          {user.status === "DELETED" && (
            <DropdownMenuItem
              className="text-destructive"
              disabled={isBusy}
              onClick={() => {
                setConfirmState({
                  title: t.confirmTitle,
                  description:
                    t.confirmHardDeleteUser ||
                    "此操作将彻底删除该用户及所有关联数据，不可恢复。确定继续？",
                  confirmLabel: t.hardDelete || "彻底删除",
                  destructive: true,
                  onConfirm: async () => {
                    await hardDeleteUser(user.id)
                  },
                })
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              {t.hardDelete || "彻底删除"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const columns: Column<AdminUser>[] = [
    ...(currentUserRole === "SUPER_ADMIN"
      ? [
          {
            key: "select" as keyof AdminUser,
            label: (
              <Checkbox
                checked={users.length > 0 && selectedIds.size === users.length}
                onCheckedChange={toggleSelectAll}
              />
            ) as unknown as string,
            width: "4%",
            render: (user: AdminUser) => (
              <Checkbox
                checked={selectedIds.has(user.id)}
                onCheckedChange={() => toggleSelect(user.id)}
              />
            ),
          },
        ]
      : []),
    {
      key: "email",
      label: t.user,
      width: currentUserRole === "SUPER_ADMIN" ? "22%" : "25%",
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {(user.name ?? user.email)[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.name || user.email.split("@")[0]}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: t.role,
      width: "10%",
      sortable: true,
      render: (user) => renderRoleBadge(user.role),
    },
    {
      key: "status",
      label: t.status,
      width: "10%",
      sortable: true,
      render: (user) => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {renderStatusBadge(user.status)}
            {user.shadowBanned && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                {adminExt.shadowHidden || "Shadowban"}
              </span>
            )}
            {isSubmitBanActive(user.preApplicationSubmitBannedUntil) && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {adminExt.submitBanBadge || "提交已封禁"}
              </span>
            )}
          </div>
          {user.status === "BANNED" && user.banReason && (
            <p className="max-w-[220px] truncate text-xs text-muted-foreground">
              {(adminExt.banReasonLabel || "封禁理由") + "：" + user.banReason}
            </p>
          )}
          {isSubmitBanActive(user.preApplicationSubmitBannedUntil) &&
            user.preApplicationSubmitBannedUntil && (
              <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                {(adminExt.submitBanUntilLabel || "封禁至") +
                  "：" +
                  new Date(user.preApplicationSubmitBannedUntil).toLocaleString(locale)}
              </p>
            )}
        </div>
      ),
    },
    {
      key: "applicationCount",
      label: t.applicationCount || "申请",
      width: "8%",
      render: (user) => <span className="text-muted-foreground">{user.applicationCount}</span>,
    },
    {
      key: "reviewCount",
      label: t.reviewCount || "审核",
      width: "8%",
      render: (user) =>
        user.role === "USER" ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <span className="text-muted-foreground">{user.reviewCount}</span>
        ),
    },
    {
      key: "createdAt",
      label: t.createdAt,
      width: "19%",
      sortable: true,
      render: (user) => (
        <span className="text-muted-foreground">
          {new Date(user.createdAt).toLocaleString(locale)}
        </span>
      ),
    },
    {
      key: "actions",
      label: t.actions,
      width: "10%",
      render: renderActions,
    },
  ]

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={Users}
          label={t.totalUsers || "总用户"}
          value={stats.total}
          color="primary"
          active={
            roleFilter === "all" &&
            statusFilter === "all" &&
            providerFilter === "all" &&
            !linuxdoTL3Filter
          }
          onClick={() => {
            setRoleFilter("all")
            setStatusFilter("all")
            setProviderFilter("all")
            setLinuxdoTL3Filter(false)
            setPage(1)
          }}
        />
        <StatCard
          icon={Shield}
          label={t.adminUsers || "管理员"}
          value={stats.admins}
          color="warning"
          active={roleFilter === "ADMIN" && providerFilter === "all" && !linuxdoTL3Filter}
          onClick={() => {
            setRoleFilter("ADMIN")
            setStatusFilter("all")
            setProviderFilter("all")
            setLinuxdoTL3Filter(false)
            setPage(1)
          }}
        />
        <StatCard
          icon={CheckCircle2}
          label={t.activeUsers || "活跃用户"}
          value={stats.active}
          color="success"
          active={statusFilter === "ACTIVE" && providerFilter === "all" && !linuxdoTL3Filter}
          onClick={() => {
            setRoleFilter("all")
            setStatusFilter("ACTIVE")
            setProviderFilter("all")
            setLinuxdoTL3Filter(false)
            setPage(1)
          }}
        />
        <StatCard
          icon={Ban}
          label={t.bannedUsers || "已禁用"}
          value={stats.banned}
          color="danger"
          active={statusFilter === "BANNED" && !linuxdoTL3Filter}
          onClick={() => {
            setRoleFilter("all")
            setStatusFilter("BANNED")
            setProviderFilter("all")
            setLinuxdoTL3Filter(false)
            setPage(1)
          }}
        />
        <StatCard
          icon={Globe}
          label={t.linuxdoUsers || "L站用户"}
          value={stats.linuxdo}
          color="primary"
          active={providerFilter === "linuxdo" && !linuxdoTL3Filter}
          onClick={() => {
            setRoleFilter("all")
            setStatusFilter("all")
            setProviderFilter("linuxdo")
            setLinuxdoTL3Filter(false)
            setPage(1)
          }}
        />
        <StatCard
          icon={Crown}
          label={t.linuxdoTL3Admins || "L站TL3管理员"}
          value={stats.linuxdoTL3Admins}
          color="warning"
          active={linuxdoTL3Filter}
          onClick={() => {
            setRoleFilter("ADMIN")
            setStatusFilter("all")
            setProviderFilter("all")
            setLinuxdoTL3Filter(true)
            setPage(1)
          }}
        />
      </div>

      {/* 搜索栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("")
                setSearch("")
                setPage(1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={adminExt.fingerprintHash || "指纹哈希"}
            value={fingerprintHashInput}
            onChange={(event) => setFingerprintHashInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-9"
          />
          {fingerprintHashInput && (
            <button
              type="button"
              onClick={() => {
                setFingerprintHashInput("")
                setFingerprintHashFilter("")
                setPage(1)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button onClick={handleSearch} variant="secondary">
          {t.searchAction}
        </Button>
        <Button onClick={handleExport} variant="secondary" disabled={exporting} className="gap-2">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {adminExt.export || "导出"}
        </Button>
        {currentUserRole === "SUPER_ADMIN" && (
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t.createUser || "创建用户"}
          </Button>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && currentUserRole === "SUPER_ADMIN" && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {(t.batchSelected || "已选 {count} 项").replace("{count}", String(selectedIds.size))}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={batchBusy}
            onClick={() => {
              setConfirmState({
                title: t.confirmTitle,
                description: (
                  t.confirmBatchPromote || "确定将选中的 {count} 个用户提升为管理员？"
                ).replace("{count}", String(selectedIds.size)),
                confirmLabel: t.batchPromote || "批量提升",
                onConfirm: async () => {
                  await batchUpdateRole("ADMIN")
                },
              })
            }}
            className="gap-1"
          >
            <Shield className="h-3.5 w-3.5" />
            {t.batchPromote || "批量提升"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={batchBusy}
            onClick={() => {
              setConfirmState({
                title: t.confirmTitle,
                description: (
                  t.confirmBatchDemote || "确定将选中的 {count} 个用户降级为普通用户？"
                ).replace("{count}", String(selectedIds.size)),
                confirmLabel: t.batchDemote || "批量降级",
                destructive: true,
                onConfirm: async () => {
                  await batchUpdateRole("USER")
                },
              })
            }}
            className="gap-1"
          >
            <ShieldOff className="h-3.5 w-3.5" />
            {t.batchDemote || "批量降级"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            {t.cancel}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <DataTable
          columns={columns}
          data={users}
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onSort={(key, direction) => {
            setSortBy(key)
            setSortOrder(direction)
          }}
          loading={loading}
          emptyMessage={t.noUsers}
          loadingText={t.loading}
          perPageText={t.perPage}
          summaryFormatter={formatPageSummary}
          mobileCardRender={(user) => (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {(user.name ?? user.email)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.name || user.email.split("@")[0]}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  {renderActions(user)}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {renderRoleBadge(user.role)}
                  {renderStatusBadge(user.status)}
                  {isSubmitBanActive(user.preApplicationSubmitBannedUntil) && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      {adminExt.submitBanBadge || "提交已封禁"}
                    </span>
                  )}
                  {user.status === "BANNED" && user.banReason && (
                    <span className="max-w-[180px] truncate text-muted-foreground">
                      {(adminExt.banReasonLabel || "封禁理由") + "：" + user.banReason}
                    </span>
                  )}
                  {isSubmitBanActive(user.preApplicationSubmitBannedUntil) &&
                    user.preApplicationSubmitBannedUntil && (
                      <span className="text-muted-foreground">
                        {(adminExt.submitBanUntilLabel || "封禁至") +
                          "：" +
                          new Date(user.preApplicationSubmitBannedUntil).toLocaleString(locale)}
                      </span>
                    )}
                  <span className="text-muted-foreground">
                    {t.applicationCount || "申请"}: {user.applicationCount}
                  </span>
                  {user.role !== "USER" && (
                    <span className="text-muted-foreground">
                      {t.reviewCount || "审核"}: {user.reviewCount}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        />
      </Card>

      {confirmState && (
        <ConfirmDialog
          open={!!confirmState}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={t.cancel}
          destructive={confirmState.destructive}
          confirming={confirming}
          onOpenChange={(open) => {
            if (!open && !confirming) {
              setConfirmState(null)
            }
          }}
          onConfirm={async () => {
            if (!confirmState) return
            setConfirming(true)
            await confirmState.onConfirm()
            setConfirming(false)
            setConfirmState(null)
          }}
        />
      )}

      <Dialog
        open={linuxdoDetailOpen}
        onOpenChange={(open) => {
          setLinuxdoDetailOpen(open)
          if (!open) {
            setSelectedLinuxdoUser(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{adminExt.linuxdoInfoTitle || "Linux.do 元信息"}</DialogTitle>
            <DialogDescription>
              {adminExt.linuxdoInfoDesc || "查看当前账号保存的 Linux.do 资料快照。"}
            </DialogDescription>
          </DialogHeader>
          {linuxdoDetailLoading ? (
            <div className="py-6 text-sm text-muted-foreground">
              {adminExt.linuxdoInfoLoading || "正在加载 Linux.do 信息..."}
            </div>
          ) : selectedLinuxdoUser?.linuxdoAccount?.providerProfile ? (
            <div className="grid gap-3 py-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{adminExt.linuxdoProfileId || "id"}</p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.id}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {adminExt.linuxdoProfileEmail || "email"}
                </p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.email || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {adminExt.linuxdoProfileName || "name"}
                </p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.name || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {adminExt.linuxdoProfileUsername || "username"}
                </p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.username || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {adminExt.linuxdoProfileAvatarUrl || "avatar_url"}
                </p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.avatar_url || "-"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  {adminExt.linuxdoProfileTrustLevel || "trust_level"}
                </p>
                <p className="break-all font-mono text-sm">
                  {selectedLinuxdoUser.linuxdoAccount.providerProfile.trust_level ?? "-"}
                </p>
              </div>
            </div>
          ) : selectedLinuxdoUser?.linuxdoAccount ? (
            <div className="py-6 text-sm text-muted-foreground">
              {adminExt.linuxdoInfoEmpty ||
                "尚未记录 Linux.do 元信息，待下次 Linux.do 登录后更新。"}
            </div>
          ) : (
            <div className="py-6 text-sm text-muted-foreground">
              {adminExt.linuxdoInfoUnavailable || "当前账号未绑定 Linux.do。"}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 创建用户对话框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {t.createUser || "创建用户"}
            </DialogTitle>
            <DialogDescription>
              {t.createUserDesc ||
                "输入邮箱地址，每行一个或用逗号/分号分隔。新用户将使用默认密码。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.createUserEmails || "邮箱地址"}</Label>
              <Textarea
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                placeholder={t.createUserPlaceholder || "user1@example.com\nuser2@example.com"}
                rows={6}
                className="resize-none font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              {t.cancel}
            </Button>
            <Button onClick={handleCreateUsers} disabled={creating} className="gap-2">
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.creating || "创建中..."}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {t.createUserSubmit || "创建"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
