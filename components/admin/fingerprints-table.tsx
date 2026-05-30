"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Fingerprint,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getRiskLevel, RISK_LEVEL_COLORS } from "@/lib/fingerprint/constants"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { FingerprintDetail } from "./fingerprint-detail"

interface FingerprintUser {
  id: string
  email: string
  name?: string | null
  status: string
  createdAt: string
}

interface FingerprintLink {
  id: string
  visitorId: string
  userIds: string[]
  riskScore: number
  status: "PENDING" | "CONFIRMED" | "CLEARED" | "IGNORED"
  reviewedAt?: string | null
  reviewNote?: string | null
  createdAt: string
  updatedAt: string
  users: FingerprintUser[]
}

interface FingerprintStats {
  PENDING: number
  CONFIRMED: number
  CLEARED: number
  IGNORED: number
}

interface FingerprintsTableProps {
  locale: Locale
  dict: Dictionary
}

export function FingerprintsTable({ locale, dict }: FingerprintsTableProps) {
  const t = dict.admin.fingerprint

  const [links, setLinks] = useState<FingerprintLink[]>([])
  const [stats, setStats] = useState<FingerprintStats>({
    PENDING: 0,
    CONFIRMED: 0,
    CLEARED: 0,
    IGNORED: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [riskFilter, setRiskFilter] = useState<string>("all")

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Detail sheet
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: "riskScore",
        sortOrder: "desc",
      })

      if (statusFilter !== "all") {
        params.set("status", statusFilter)
      }

      if (riskFilter !== "all") {
        const minScore = riskFilter === "high" ? 70 : riskFilter === "medium" ? 30 : 0
        params.set("minRiskScore", String(minScore))
      }

      if (search) {
        params.set("search", search)
      }

      const response = await fetch(`/api/admin/fingerprints?${params}`)
      if (!response.ok) {
        throw new Error("Failed to fetch")
      }

      const data = await response.json()
      setLinks(data.data)
      setStats(data.stats)
      setTotal(data.pagination.total)
    } catch {
      setError(t.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, statusFilter, riskFilter, search, t.loadFailed])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchData()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "CONFIRMED":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "CLEARED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "IGNORED":
        return <XCircle className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase() as keyof typeof t.status
    return t.status[key] ?? status
  }

  const getRiskBadge = (score: number) => {
    const level = getRiskLevel(score)
    const color = RISK_LEVEL_COLORS[level]

    return (
      <Badge
        variant="outline"
        className={cn(
          color === "red" && "border-red-500 text-red-500",
          color === "yellow" && "border-yellow-500 text-yellow-500",
          color === "green" && "border-green-500 text-green-500",
        )}
      >
        {score}
      </Badge>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.stats.pending}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.PENDING}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.stats.confirmed}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.CONFIRMED}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.stats.cleared}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.CLEARED}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t.stats.ignored}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{stats.IGNORED}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.filterByStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatus}</SelectItem>
                <SelectItem value="PENDING">{t.status.pending}</SelectItem>
                <SelectItem value="CONFIRMED">{t.status.confirmed}</SelectItem>
                <SelectItem value="CLEARED">{t.status.cleared}</SelectItem>
                <SelectItem value="IGNORED">{t.status.ignored}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.filterByRisk} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allRisk}</SelectItem>
                <SelectItem value="high">{t.riskLevel.high}</SelectItem>
                <SelectItem value="medium">{t.riskLevel.medium}</SelectItem>
                <SelectItem value="low">{t.riskLevel.low}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="p-8 text-center text-destructive">{error}</div>
          ) : links.length === 0 && !loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Fingerprint className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t.empty}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.visitorId}</TableHead>
                  <TableHead>{t.columns.linkedUsers}</TableHead>
                  <TableHead>{t.columns.riskScore}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                  <TableHead>{t.columns.lastSeen}</TableHead>
                  <TableHead className="w-[100px]">{t.columns.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : (
                  links.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {link.visitorId.substring(0, 16)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {link.users.slice(0, 2).map((user) => (
                            <div
                              key={user.id}
                              className="text-sm truncate max-w-[200px]"
                            >
                              {user.email}
                            </div>
                          ))}
                          {link.users.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{link.users.length - 2}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRiskBadge(link.riskScore)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(link.status)}
                          <span className="text-sm">{getStatusLabel(link.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(link.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLinkId(link.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{total}</div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet
        open={!!selectedLinkId}
        onOpenChange={(open) => !open && setSelectedLinkId(null)}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.detail.title}</SheetTitle>
          </SheetHeader>
          {selectedLinkId && (
            <FingerprintDetail
              locale={locale}
              dict={dict}
              linkId={selectedLinkId}
              onReviewed={() => {
                setSelectedLinkId(null)
                fetchData()
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
