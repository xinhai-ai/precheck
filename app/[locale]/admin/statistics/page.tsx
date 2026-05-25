import Link from "next/link"
import {
  Activity,
  BarChart3,
  Fingerprint,
  LineChart,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getAdminStatisticsOverview, type StatisticDistribution } from "@/lib/statistics/admin-statistics"

interface AdminStatisticsPageProps {
  params: Promise<{ locale: Locale }>
}

function formatValue(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value
}

function MetricCards({ title, items }: { title: string; items: Array<{ label: string; value: number | string; helper?: string }> }) {
  return (
    <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="text-sm text-muted-foreground">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{formatValue(item.value)}</div>
            {item.helper && <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DistributionList({ title, items }: { title: string; items: StatisticDistribution[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">暂无数据</div>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="truncate text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground">
                  {item.value.toLocaleString()} · {item.percentage}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(item.percentage, 3)}%` }} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

export default async function AdminStatisticsPage({ params }: AdminStatisticsPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)

  const statistics = db ? await getAdminStatisticsOverview(db) : null

  if (!statistics) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{dict.admin.statisticsCenter}</h1>
          <p className="mt-1 text-muted-foreground">{dict.admin.statisticsCenterDesc}</p>
        </div>
        <Card>
          <CardContent className="p-6 text-muted-foreground">数据库未配置，统计中心暂时无法读取数据。</CardContent>
        </Card>
      </div>
    )
  }

  const maxSeriesValue = Math.max(
    1,
    ...statistics.aggregation.map((point) => point.users + point.applications + point.audits),
  )

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.18),_transparent_36%),linear-gradient(135deg,_hsl(var(--card)),_hsl(var(--muted)/0.4))] p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge className="mb-4 gap-1" variant="secondary">
              <LineChart className="h-3.5 w-3.5" />
              {statistics.rangeDays} 天聚合视图
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight">{dict.admin.statisticsCenter}</h1>
            <p className="mt-3 max-w-3xl text-muted-foreground">{dict.admin.statisticsCenterDesc}</p>
          </div>
          <div className="rounded-2xl border bg-background/75 px-4 py-3 text-sm text-muted-foreground">
            更新时间：{new Date(statistics.generatedAt).toLocaleString(locale)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MetricCards title="全站运营" items={statistics.kpis.operations} />
        <MetricCards title="转化与留存" items={statistics.kpis.conversion} />
        <MetricCards title="审核效率" items={statistics.kpis.review} />
        <MetricCards title="安全与系统健康" items={[...statistics.kpis.security, ...statistics.kpis.systemHealth]} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            聚合趋势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-56 items-end gap-1 overflow-hidden rounded-2xl border bg-muted/20 p-4">
            {statistics.aggregation.map((point) => {
              const total = point.users + point.applications + point.audits
              return (
                <div key={point.bucket} className="flex min-w-4 flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-lg bg-background" style={{ height: 180 }}>
                    <div className="bg-primary" style={{ height: `${(point.users / maxSeriesValue) * 180}px` }} />
                    <div className="bg-chart-2" style={{ height: `${(point.applications / maxSeriesValue) * 180}px` }} />
                    <div className="bg-chart-3" style={{ height: `${(point.audits / maxSeriesValue) * 180}px` }} />
                  </div>
                  <span className="hidden text-[10px] text-muted-foreground md:inline">{point.bucket.slice(5)}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" />账号</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-chart-2" />预申请</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-chart-3" />审计</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <DistributionList title="预申请来源" items={statistics.sourceAttribution.preApplicationSources} />
        <DistributionList title="OAuth 来源" items={statistics.sourceAttribution.oauthProviders} />
        <MetricCards title="Referer 与 UTM" items={statistics.sourceAttribution.refererReadiness} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <DistributionList title="行为分析" items={statistics.behavior} />
        <DistributionList title="转化分析" items={statistics.conversion} />
        <DistributionList title="留存分析" items={statistics.retention} />
        <DistributionList title="审核分析" items={statistics.review} />
        <DistributionList title="安全分析" items={statistics.security} />
        <DistributionList title="系统健康" items={statistics.systemHealth} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            指标字典
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {statistics.metricDefinitions.map((metric) => (
            <div key={metric.key} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{metric.label}</div>
                <Badge variant={metric.scope === "super_admin" ? "destructive" : "secondary"}>{metric.scope}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{metric.key}</div>
              <div className="mt-3 text-sm text-muted-foreground">{metric.formula}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4 text-primary" />
              账号画像入口
            </div>
            <p className="mt-1 text-sm text-muted-foreground">账号画像页面位于 /admin/statistics/accounts/[id]，展示来源、生命周期、行为和安全摘要。</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LockKeyhole className="h-4 w-4" />超级管理员查看完整明细
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
