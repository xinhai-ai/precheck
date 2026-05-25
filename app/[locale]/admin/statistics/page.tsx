import {
  Activity,
  BarChart3,
  LineChart,
} from "lucide-react"
import type { Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  getAdminStatisticsOverview,
  type StatisticCard,
  type StatisticDistribution,
  type StatisticModule,
} from "@/lib/statistics/admin-statistics"

interface AdminStatisticsPageProps {
  params: Promise<{ locale: Locale }>
}

function formatValue(value: number | string) {
  return typeof value === "number" ? value.toLocaleString() : value
}

type UnifiedChartTone = {
  badge: string
  bar: string
  dot: string
  surface: string
}

type UnifiedStatisticsChartRow = StatisticDistribution & {
  group: string
  tone: UnifiedChartTone
}

const chartTones: UnifiedChartTone[] = [
  {
    badge: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
    surface: "from-sky-500/15 to-sky-500/5",
  },
  {
    badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
    dot: "bg-violet-500",
    surface: "from-violet-500/15 to-violet-500/5",
  },
  {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    surface: "from-emerald-500/15 to-emerald-500/5",
  },
  {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    surface: "from-amber-500/15 to-amber-500/5",
  },
  {
    badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    surface: "from-rose-500/15 to-rose-500/5",
  },
  {
    badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    bar: "bg-cyan-500",
    dot: "bg-cyan-500",
    surface: "from-cyan-500/15 to-cyan-500/5",
  },
  {
    badge: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
    bar: "bg-fuchsia-500",
    dot: "bg-fuchsia-500",
    surface: "from-fuchsia-500/15 to-fuchsia-500/5",
  },
  {
    badge: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
    bar: "bg-lime-500",
    dot: "bg-lime-500",
    surface: "from-lime-500/15 to-lime-500/5",
  },
]

function toChartRows(group: string, items: StatisticDistribution[], toneIndex: number): UnifiedStatisticsChartRow[] {
  const tone = chartTones[toneIndex % chartTones.length]
  return items.map((item) => ({ ...item, group, tone }))
}

function ModulePanel({ module, tone }: { module: StatisticModule; tone: UnifiedChartTone }) {
  const maxValue = Math.max(1, ...module.rows.map((row) => row.value))
  const isFunnel = module.chart === "funnel"
  const isRetention = module.chart === "retention"

  return (
    <Card className={`overflow-hidden border-primary/10 bg-gradient-to-br ${tone.surface}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="secondary" className={tone.badge}>
              {module.title}
            </Badge>
            <CardTitle className="mt-3 text-lg">{module.title}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{module.description}</p>
          </div>
          <div className={`mt-1 h-3 w-3 rounded-full ${tone.dot}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {module.cards.slice(0, 4).map((item) => (
            <div key={item.label} className="rounded-2xl border bg-background/75 p-4">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="mt-2 break-words text-2xl font-semibold">{formatValue(item.value)}</div>
              {item.helper && <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {module.rows.slice(0, 8).map((row, index) => {
            const width = isFunnel || isRetention ? Math.max(row.percentage, row.value > 0 ? 4 : 0) : Math.max((row.value / maxValue) * 100, row.value > 0 ? 4 : 0)

            return (
              <div key={`${module.key}-${row.label}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{isFunnel ? `${index + 1}. ${row.label}` : row.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {row.value.toLocaleString()} · {row.percentage}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-background/80 shadow-inner">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
          {module.rows.length === 0 && (
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">暂无数据</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatisticsModuleGrid({ modules }: { modules: StatisticModule[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {modules.map((module, index) => (
        <ModulePanel key={module.key} module={module} tone={chartTones[index % chartTones.length]} />
      ))}
    </div>
  )
}

function UnifiedStatisticsChart({
  rows,
  readiness,
}: {
  rows: UnifiedStatisticsChartRow[]
  readiness: StatisticCard[]
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value))
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0)
  const strongestRow = rows.reduce<UnifiedStatisticsChartRow | null>(
    (current, row) => (!current || row.value > current.value ? row : current),
    null,
  )

  return (
    <Card className="overflow-hidden border-primary/10">
      <CardHeader className="border-b bg-[radial-gradient(circle_at_top_right,_hsl(var(--primary)/0.16),_transparent_32%)]">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          运营分布总图
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          来源、行为、转化、留存、审核、安全与系统健康使用同一刻度展示，颜色代表模块，长度代表规模。
        </p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signals</div>
            <div className="mt-2 text-2xl font-semibold">{rows.length.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">纳入总图的统计项</div>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Volume</div>
            <div className="mt-2 text-2xl font-semibold">{totalValue.toLocaleString()}</div>
            <div className="mt-1 text-xs text-muted-foreground">统一口径下的累计量</div>
          </div>
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Peak</div>
            <div className="mt-2 truncate text-2xl font-semibold">{strongestRow?.label || "暂无"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {strongestRow ? `${strongestRow.group} · ${strongestRow.value.toLocaleString()}` : "暂无数据"}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">暂无数据</div>
        ) : (
          <div className="overflow-hidden rounded-3xl border bg-background">
            <div className="grid grid-cols-[minmax(112px,0.9fr)_minmax(160px,1.1fr)_minmax(180px,3fr)_minmax(72px,0.6fr)] border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <span>Module</span>
              <span>Metric</span>
              <span>Unified scale</span>
              <span className="text-right">Share</span>
            </div>
            <div className="divide-y">
              {rows.map((row) => {
                const width = Math.max((row.value / maxValue) * 100, row.value > 0 ? 4 : 0)

                return (
                  <div
                    key={`${row.group}-${row.label}`}
                    className={`grid grid-cols-1 gap-3 bg-gradient-to-r px-4 py-4 ${row.tone.surface} md:grid-cols-[minmax(112px,0.9fr)_minmax(160px,1.1fr)_minmax(180px,3fr)_minmax(72px,0.6fr)] md:items-center`}
                  >
                    <div>
                      <Badge variant="secondary" className={row.tone.badge}>
                        <span className={`mr-1.5 h-2 w-2 rounded-full ${row.tone.dot}`} />
                        {row.group}
                      </Badge>
                    </div>
                    <div>
                      <div className="font-medium">{row.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{row.value.toLocaleString()} 次</div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 overflow-hidden rounded-full bg-background/80 shadow-inner">
                        <div className={`h-full rounded-full ${row.tone.bar}`} style={{ width: `${width}%` }} />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[25, 50, 75, 100].map((mark) => (
                          <span key={mark} className="h-1 rounded-full bg-background/70" />
                        ))}
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold">{row.percentage}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {readiness.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {readiness.map((item) => (
              <div key={item.label} className="rounded-2xl border border-dashed bg-muted/10 p-4">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="mt-2 text-lg font-semibold">{formatValue(item.value)}</div>
                {item.helper && <div className="mt-1 text-xs text-muted-foreground">{item.helper}</div>}
              </div>
            ))}
          </div>
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
  const chartRows = [
    ...toChartRows("预申请来源", statistics.sourceAttribution.preApplicationSources, 0),
    ...toChartRows("OAuth 来源", statistics.sourceAttribution.oauthProviders, 1),
    ...toChartRows("行为", statistics.behavior, 2),
    ...toChartRows("转化", statistics.conversion, 3),
    ...toChartRows("留存", statistics.retention, 4),
    ...toChartRows("审核", statistics.review, 5),
    ...toChartRows("安全", statistics.security, 6),
    ...toChartRows("系统健康", statistics.systemHealth, 7),
  ]

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

      <StatisticsModuleGrid modules={statistics.modules} />

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

      <UnifiedStatisticsChart rows={chartRows} readiness={statistics.sourceAttribution.refererReadiness} />
    </div>
  )
}
