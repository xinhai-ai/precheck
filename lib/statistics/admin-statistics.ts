import { maskEmail, maskHash, maskIp } from "@/lib/statistics/traffic-attribution"

export type StatisticCard = {
  label: string
  value: number | string
  helper?: string
}

export type StatisticDistribution = {
  label: string
  value: number
  percentage: number
}

export type StatisticSeriesPoint = {
  bucket: string
  users: number
  applications: number
  audits: number
}

export type AdminStatisticsOverview = {
  rangeDays: number
  generatedAt: string
  kpis: {
    operations: StatisticCard[]
    conversion: StatisticCard[]
    review: StatisticCard[]
    security: StatisticCard[]
    systemHealth: StatisticCard[]
  }
  sourceAttribution: {
    preApplicationSources: StatisticDistribution[]
    oauthProviders: StatisticDistribution[]
    refererReadiness: StatisticCard[]
  }
  behavior: StatisticDistribution[]
  conversion: StatisticDistribution[]
  retention: StatisticDistribution[]
  review: StatisticDistribution[]
  security: StatisticDistribution[]
  systemHealth: StatisticDistribution[]
  aggregation: StatisticSeriesPoint[]
}

export type AdminAccountStatistics = {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
  country: string | null
  sourceAttribution: StatisticCard[]
  lifecycle: StatisticCard[]
  behavior: StatisticCard[]
  security: StatisticCard[]
  auditTrail: Array<{
    action: string
    entityType: string
    createdAt: string
    ip: string
    userAgent: string
  }>
}

type StatisticsDb = any

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function ratioLabel(value: number, total: number) {
  return `${percentage(value, total)}%`
}

function toDistribution(rows: Array<{ label: string | null; value: number }>, fallbackLabel = "Unknown") {
  const total = rows.reduce((sum, row) => sum + row.value, 0)
  return rows.map((row) => ({
    label: row.label || fallbackLabel,
    value: row.value,
    percentage: percentage(row.value, total),
  }))
}

function buildEmptyAggregation(rangeStart: Date, rangeDays: number) {
  return Array.from({ length: rangeDays }, (_, index) => {
    const bucket = formatDateKey(addDays(rangeStart, index))
    return { bucket, users: 0, applications: 0, audits: 0 }
  })
}

function addSeriesCount(
  series: Map<string, StatisticSeriesPoint>,
  date: Date,
  key: keyof Pick<StatisticSeriesPoint, "users" | "applications" | "audits">,
) {
  const bucket = formatDateKey(date)
  const current = series.get(bucket)
  if (!current) return
  current[key] += 1
}

export async function getAdminStatisticsOverview(
  db: StatisticsDb,
  options: { rangeDays?: number } = {},
): Promise<AdminStatisticsOverview> {
  const rangeDays = Math.min(Math.max(options.rangeDays ?? 30, 7), 90)
  const now = new Date()
  const rangeStart = startOfDay(addDays(now, -rangeDays + 1))

  const [
    totalUsers,
    activeUsers,
    bannedUsers,
    newUsers,
    totalPosts,
    publishedPosts,
    totalViews,
    totalApplications,
    submittedApplications,
    approvedApplications,
    rejectedApplications,
    pendingApplications,
    appeals,
    tickets,
    resolvedTickets,
    messages,
    messageRecipients,
    messageReads,
    apiTokens,
    passkeys,
    fingerprintEvents,
    similarityEvents,
    riskClusters,
    auditLogs,
    adminAuditLogs,
    systemAuditLogs,
    preApplicationSourceRows,
    oauthProviderRows,
    auditEntityRows,
    reviewRows,
    userRows,
    applicationRows,
    auditRows,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "BANNED" } }),
    db.user.count({ where: { createdAt: { gte: rangeStart } } }),
    db.post.count(),
    db.post.count({ where: { status: "PUBLISHED" } }),
    db.post.aggregate({ _sum: { views: true } }),
    db.preApplication.count(),
    db.preApplication.count({ where: { createdAt: { gte: rangeStart } } }),
    db.preApplication.count({ where: { status: "APPROVED" } }),
    db.preApplication.count({ where: { status: "REJECTED" } }),
    db.preApplication.count({ where: { status: "PENDING" } }),
    db.preApplicationAppeal.count({ where: { createdAt: { gte: rangeStart } } }),
    db.ticket.count({ where: { createdAt: { gte: rangeStart } } }),
    db.ticket.count({ where: { resolvedAt: { gte: rangeStart } } }),
    db.message.count({ where: { createdAt: { gte: rangeStart } } }),
    db.messageRecipient.count({ where: { createdAt: { gte: rangeStart } } }),
    db.messageRecipient.count({ where: { readAt: { gte: rangeStart } } }),
    db.apiToken.count({ where: { revokedAt: null } }),
    db.passkeyCredential.count(),
    db.fingerprintEvent.count({ where: { createdAt: { gte: rangeStart } } }),
    db.fingerprintEvent.count({ where: { createdAt: { gte: rangeStart }, similarityScore: { gte: 70 } } }),
    db.fingerprintRiskCluster?.count?.() ?? Promise.resolve(0),
    db.auditLog.count({ where: { createdAt: { gte: rangeStart } } }),
    db.auditLog.count({
      where: { createdAt: { gte: rangeStart }, actorRole: { in: ["ADMIN", "SUPER_ADMIN"] } },
    }),
    db.auditLog.count({ where: { createdAt: { gte: rangeStart }, entityType: "SYSTEM" } }),
    db.preApplication.groupBy({ by: ["source"], _count: true }),
    db.account.groupBy({ by: ["provider"], _count: true }),
    db.auditLog.groupBy({ by: ["entityType"], where: { createdAt: { gte: rangeStart } }, _count: true }),
    db.preApplication.findMany({
      where: { reviewedAt: { not: null, gte: rangeStart } },
      select: { createdAt: true, reviewedAt: true, status: true },
      take: 500,
    }),
    db.user.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true }, take: 1000 }),
    db.preApplication.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true },
      take: 1000,
    }),
    db.auditLog.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true }, take: 1000 }),
  ])

  const processedApplications = approvedApplications + rejectedApplications
  const averageReviewHours = reviewRows.length
    ? Math.round(
        reviewRows.reduce((sum: number, row: any) => {
          if (!row.reviewedAt) return sum
          return sum + (row.reviewedAt.getTime() - row.createdAt.getTime()) / 1000 / 60 / 60
        }, 0) / reviewRows.length,
      )
    : 0

  const aggregationMap = new Map(
    buildEmptyAggregation(rangeStart, rangeDays).map((point) => [point.bucket, point]),
  )
  userRows.forEach((row: any) => addSeriesCount(aggregationMap, row.createdAt, "users"))
  applicationRows.forEach((row: any) => addSeriesCount(aggregationMap, row.createdAt, "applications"))
  auditRows.forEach((row: any) => addSeriesCount(aggregationMap, row.createdAt, "audits"))

  return {
    rangeDays,
    generatedAt: now.toISOString(),
    kpis: {
      operations: [
        { label: "累计账号", value: totalUsers, helper: `${newUsers} 个近期新增` },
        { label: "活跃账号", value: activeUsers, helper: `${bannedUsers} 个封禁账号` },
        { label: "文章总数", value: totalPosts, helper: `${publishedPosts} 篇已发布` },
        { label: "总浏览量", value: totalViews._sum.views || 0 },
      ],
      conversion: [
        { label: "预申请总数", value: totalApplications, helper: `${submittedApplications} 个近期提交` },
        { label: "申请通过率", value: ratioLabel(approvedApplications, processedApplications) },
        { label: "站内信阅读率", value: ratioLabel(messageReads, messageRecipients) },
        { label: "工单解决率", value: ratioLabel(resolvedTickets, tickets) },
      ],
      review: [
        { label: "待审核", value: pendingApplications },
        { label: "已通过", value: approvedApplications },
        { label: "已驳回", value: rejectedApplications },
        { label: "平均审核时长", value: `${averageReviewHours}h` },
      ],
      security: [
        { label: "指纹事件", value: fingerprintEvents },
        { label: "相似命中", value: similarityEvents },
        { label: "安全群组", value: riskClusters },
        { label: "Passkey", value: passkeys },
      ],
      systemHealth: [
        { label: "审计记录", value: auditLogs },
        { label: "后台操作", value: adminAuditLogs },
        { label: "系统记录", value: systemAuditLogs },
        { label: "有效 Token", value: apiTokens },
      ],
    },
    sourceAttribution: {
      preApplicationSources: toDistribution(
        preApplicationSourceRows
          .map((row: any) => ({ label: row.source, value: row._count }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 8),
      ),
      oauthProviders: toDistribution(
        oauthProviderRows
          .map((row: any) => ({ label: row.provider, value: row._count }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 8),
      ),
      refererReadiness: [
        { label: "Referer 捕获", value: "已提供解析与脱敏能力", helper: "后续事件会写入来源域名" },
        { label: "UTM 参数", value: "已纳入来源优先级", helper: "优先级高于 Referer" },
      ],
    },
    behavior: toDistribution(
      auditEntityRows.map((row: any) => ({ label: row.entityType, value: row._count })),
      "OTHER",
    ),
    conversion: [
      { label: "注册到预申请", value: submittedApplications, percentage: percentage(submittedApplications, newUsers) },
      { label: "预申请到通过", value: approvedApplications, percentage: percentage(approvedApplications, totalApplications) },
      { label: "站内信阅读", value: messageReads, percentage: percentage(messageReads, messageRecipients) },
      { label: "工单解决", value: resolvedTickets, percentage: percentage(resolvedTickets, tickets) },
    ],
    retention: [
      { label: "近期新增账号", value: newUsers, percentage: percentage(newUsers, totalUsers) },
      { label: "近期审计活跃", value: auditLogs, percentage: percentage(auditLogs, Math.max(totalUsers, 1)) },
      { label: "近期内容互动", value: messageReads + tickets + submittedApplications, percentage: 100 },
    ],
    review: [
      { label: "待审核", value: pendingApplications, percentage: percentage(pendingApplications, totalApplications) },
      { label: "已通过", value: approvedApplications, percentage: percentage(approvedApplications, totalApplications) },
      { label: "已驳回", value: rejectedApplications, percentage: percentage(rejectedApplications, totalApplications) },
      { label: "近期申诉", value: appeals, percentage: percentage(appeals, totalApplications) },
    ],
    security: [
      { label: "指纹事件", value: fingerprintEvents, percentage: 100 },
      { label: "相似命中", value: similarityEvents, percentage: percentage(similarityEvents, fingerprintEvents) },
      { label: "安全群组", value: riskClusters, percentage: 100 },
    ],
    systemHealth: [
      { label: "审计记录", value: auditLogs, percentage: 100 },
      { label: "后台操作", value: adminAuditLogs, percentage: percentage(adminAuditLogs, auditLogs) },
      { label: "系统记录", value: systemAuditLogs, percentage: percentage(systemAuditLogs, auditLogs) },
    ],
    aggregation: Array.from(aggregationMap.values()),
  }
}

export async function getAdminAccountStatistics(
  db: StatisticsDb,
  userId: string,
): Promise<AdminAccountStatistics | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { select: { provider: true, trustLevel: true } },
      preApplications: {
        select: { id: true, source: true, sourceDetail: true, status: true, createdAt: true, reviewedAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      messageRecipients: { select: { readAt: true, deletedAt: true }, take: 200 },
      apiTokens: { select: { lastUsedAt: true, revokedAt: true }, take: 20 },
      passkeyCredentials: { select: { lastUsedAt: true, createdAt: true, deviceType: true }, take: 20 },
      fingerprintEvents: {
        select: {
          createdAt: true,
          eventType: true,
          fingerprintHash: true,
          similarityScore: true,
          ip: true,
          userAgent: true,
          browserFamily: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!user) return null

  const [postCount, ticketCount, auditLogs] = await Promise.all([
    db.post.count({ where: { authorId: userId } }),
    db.ticket.count({ where: { userId } }),
    db.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { action: true, entityType: true, createdAt: true, ip: true, userAgent: true },
    }),
  ])

  const latestApplication = user.preApplications[0]
  const latestFingerprint = user.fingerprintEvents[0]
  const readMessages = user.messageRecipients.filter((item: any) => item.readAt).length
  const activeTokens = user.apiTokens.filter((item: any) => !item.revokedAt).length

  return {
    id: user.id,
    email: maskEmail(user.email),
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    country: user.country,
    sourceAttribution: [
      { label: "OAuth 来源", value: user.accounts.map((account: any) => account.provider).join(", ") || "Direct" },
      { label: "预申请来源", value: latestApplication?.source || "Unknown" },
      { label: "来源详情", value: latestApplication?.sourceDetail || "无" },
    ],
    lifecycle: [
      { label: "注册时间", value: user.createdAt.toISOString().slice(0, 10) },
      { label: "预申请次数", value: user.preApplications.length },
      { label: "当前申请状态", value: latestApplication?.status || "无" },
      { label: "最近审核", value: latestApplication?.reviewedAt?.toISOString().slice(0, 10) || "无" },
    ],
    behavior: [
      { label: "文章数", value: postCount },
      { label: "站内信已读", value: readMessages, helper: `${user.messageRecipients.length} 条收件` },
      { label: "工单数", value: ticketCount },
      { label: "有效 Token", value: activeTokens },
      { label: "Passkey", value: user.passkeyCredentials.length },
    ],
    security: [
      { label: "最新指纹", value: maskHash(latestFingerprint?.fingerprintHash) || "无" },
      { label: "最新 IP", value: maskIp(latestFingerprint?.ip) || "无" },
      { label: "浏览器", value: latestFingerprint?.browserFamily || "Unknown" },
      { label: "相似分", value: latestFingerprint?.similarityScore ?? 0 },
    ],
    auditTrail: auditLogs.map((log: any) => ({
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt.toISOString(),
      ip: maskIp(log.ip),
      userAgent: log.userAgent ? `${log.userAgent.slice(0, 80)}${log.userAgent.length > 80 ? "…" : ""}` : "",
    })),
  }
}
