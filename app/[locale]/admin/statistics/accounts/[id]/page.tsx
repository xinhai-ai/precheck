import { notFound } from "next/navigation"
import { Fingerprint, ShieldCheck, UserRound } from "lucide-react"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAdminAccountStatistics } from "@/lib/statistics/admin-statistics"

interface AccountStatisticsPageProps {
  params: Promise<{ locale: Locale; id: string }>
}

function StatCardList({ title, items }: { title: string; items: Array<{ label: string; value: number | string; helper?: string }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm text-muted-foreground">{item.label}</div>
            <div className="mt-2 break-words text-xl font-semibold">{item.value}</div>
            {item.helper && <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default async function AccountStatisticsPage({ params }: AccountStatisticsPageProps) {
  const { locale, id } = await params
  const dict = await getDictionary(locale)
  const currentUser = await getCurrentUser()

  if (currentUser?.role !== "SUPER_ADMIN") {
    notFound()
  }

  if (!db) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{dict.admin.accountStatistics}</h1>
          <p className="mt-1 text-muted-foreground">数据库未配置，账号画像暂时无法读取数据。</p>
        </div>
      </div>
    )
  }

  const account = await getAdminAccountStatistics(db, id)
  if (!account) notFound()

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border bg-gradient-to-br from-card to-primary/5 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1">
              <UserRound className="h-3.5 w-3.5" />
              {dict.admin.accountStatistics}
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">{account.name || account.email}</h1>
            <p className="mt-2 text-muted-foreground">{account.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{account.role}</Badge>
            <Badge variant={account.status === "ACTIVE" ? "secondary" : "destructive"}>{account.status}</Badge>
            {account.country && <Badge variant="outline">{account.country}</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <StatCardList title="来源归因" items={account.sourceAttribution} />
        <StatCardList title="生命周期" items={account.lifecycle} />
        <StatCardList title="行为摘要" items={account.behavior} />
        <StatCardList title="安全摘要" items={account.security} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            脱敏审计记录
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {account.auditTrail.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无审计记录</div>
          ) : (
            account.auditTrail.map((log) => (
              <div key={`${log.action}-${log.createdAt}`} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">{log.action}</div>
                  <Badge variant="outline">{log.entityType}</Badge>
                </div>
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                  <span>{new Date(log.createdAt).toLocaleString(locale)}</span>
                  <span>{log.ip || "IP 未记录"}</span>
                  <span className="truncate">{log.userAgent || "UA 未记录"}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          账号画像仅超级管理员可见，邮箱、IP 与指纹字段默认脱敏展示。
        </CardContent>
      </Card>
    </div>
  )
}
