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

export type StatisticModuleKey =
  | "overview"
  | "source"
  | "conversion"
  | "retention"
  | "behavior"
  | "review"
  | "security"
  | "system"

export type StatisticModule = {
  key: StatisticModuleKey
  title: string
  description: string
  chart: "scorecards" | "distribution" | "ranking" | "funnel" | "retention" | "trend"
  cards: StatisticCard[]
  rows: StatisticDistribution[]
}

export type AccountTimelineItem = {
  label: string
  at: string
  status: string
  helper?: string
}

export type AccountRecordItem = {
  label: string
  value: string
  helper?: string
  at?: string
  badge?: string
}

export type RelatedAccountItem = {
  id: string
  email: string
  status: string
  reason: string
  lastSeenAt?: string
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
  modules: StatisticModule[]
}

export type AdminAccountStatistics = {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
  country: string | null
  basicInfo: StatisticCard[]
  sourceProfile: StatisticCard[]
  lifecycleTimeline: AccountTimelineItem[]
  sourceAttribution: StatisticCard[]
  lifecycle: StatisticCard[]
  behavior: StatisticCard[]
  reviewLinks: AccountRecordItem[]
  security: StatisticCard[]
  relatedAccounts: RelatedAccountItem[]
  managementRecords: AccountRecordItem[]
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

function formatShortDate(date?: Date | string | null) {
  if (!date) return "无"
  return new Date(date).toISOString().slice(0, 10)
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

function toFunnelDistribution(rows: Array<{ label: string; value: number }>) {
  return rows.map((row, index) => {
    const previous = index === 0 ? row.value : rows[index - 1]?.value || 0
    return {
      label: row.label,
      value: row.value,
      percentage: index === 0 ? 100 : percentage(row.value, previous),
    }
  })
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

function countRetainedUsers(
  users: Array<{ id: string; createdAt: Date }>,
  audits: Array<{ actorId: string | null; createdAt: Date }>,
  now: Date,
  days: number,
) {
  const eligibleUsers = users.filter((user) => addDays(user.createdAt, days) <= now)
  const retainedIds = new Set<string>()

  eligibleUsers.forEach((user) => {
    const activeAfterWindow = audits.some(
      (audit) => audit.actorId === user.id && audit.createdAt >= addDays(user.createdAt, days),
    )
    if (activeAfterWindow) retainedIds.add(user.id)
  })

  return {
    retained: retainedIds.size,
    eligible: eligibleUsers.length,
  }
}

function latestDate(...dates: Array<Date | string | null | undefined>) {
  const validDates = dates
    .filter(Boolean)
    .map((date) => new Date(date as Date | string))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())
  return validDates[0]
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
    authAuditLogs,
    apiErrorLogs,
    databaseExceptionLogs,
    shadowBannedUsers,
    usedInviteCodes,
    issuedInviteCodes,
    preApplicationSourceRows,
    oauthProviderRows,
    countryRows,
    browserRows,
    deviceRows,
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
    db.auditLog.count({ where: { createdAt: { gte: rangeStart }, entityType: "AUTH" } }),
    db.auditLog.count({ where: { createdAt: { gte: rangeStart }, action: { contains: "ERROR" } } }),
    db.auditLog.count({ where: { createdAt: { gte: rangeStart }, entityType: "DATABASE" } }),
    db.shadowBannedUser?.count?.() ?? Promise.resolve(0),
    db.inviteCode.count({ where: { usedAt: { gte: rangeStart } } }),
    db.inviteCode.count({ where: { issuedAt: { gte: rangeStart } } }),
    db.preApplication.groupBy({ by: ["source"], _count: true }),
    db.account.groupBy({ by: ["provider"], _count: true }),
    db.user.groupBy({
      by: ["country"],
      where: { country: { not: null } },
      _count: true,
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),
    db.fingerprintEvent.groupBy({
      by: ["browserFamily"],
      where: { createdAt: { gte: rangeStart }, browserFamily: { not: null } },
      _count: true,
      orderBy: { _count: { browserFamily: "desc" } },
      take: 8,
    }),
    db.passkeyCredential.groupBy({
      by: ["deviceType"],
      _count: true,
      orderBy: { _count: { deviceType: "desc" } },
      take: 8,
    }),
    db.auditLog.groupBy({ by: ["entityType"], where: { createdAt: { gte: rangeStart } }, _count: true }),
    db.preApplication.findMany({
      where: { reviewedAt: { not: null, gte: rangeStart } },
      select: { createdAt: true, reviewedAt: true, status: true, reviewedById: true },
      take: 500,
    }),
    db.user.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { id: true, createdAt: true },
      take: 1000,
    }),
    db.preApplication.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true },
      take: 1000,
    }),
    db.auditLog.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { actorId: true, createdAt: true, entityType: true, action: true },
      take: 1000,
    }),
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

  const viewCount = totalViews._sum.views || 0
  const oauthAccountCount = oauthProviderRows.reduce((sum: number, row: any) => sum + row._count, 0)
  const sourceAttribution = {
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
  }
  const countryDistribution = toDistribution(
    countryRows.map((row: any) => ({ label: row.country, value: row._count })),
    "Unknown",
  )
  const browserDistribution = toDistribution(
    browserRows.map((row: any) => ({ label: row.browserFamily, value: row._count })),
    "Unknown",
  )
  const deviceDistribution = toDistribution(
    deviceRows.map((row: any) => ({ label: row.deviceType, value: row._count })),
    "Unknown",
  )
  const registrationDistribution = toDistribution([
    { label: "OAuth 绑定记录", value: oauthAccountCount },
    { label: "邮箱注册估算", value: Math.max(totalUsers - oauthAccountCount, 0) },
  ])
  const inviteDistribution = toDistribution([
    { label: "邀请发放", value: issuedInviteCodes },
    { label: "邀请使用", value: usedInviteCodes },
  ])
  const behavior = toDistribution(
    [
      ...auditEntityRows.map((row: any) => ({ label: row.entityType, value: row._count })),
      { label: "提交预申请", value: submittedApplications },
      { label: "创建文章", value: totalPosts },
      { label: "阅读站内信", value: messageReads },
      { label: "发起工单", value: tickets },
      { label: "申诉", value: appeals },
    ],
    "OTHER",
  )
  const conversion = [
    { label: "注册到预申请", value: submittedApplications, percentage: percentage(submittedApplications, newUsers) },
    { label: "预申请到通过", value: approvedApplications, percentage: percentage(approvedApplications, totalApplications) },
    { label: "站内信阅读", value: messageReads, percentage: percentage(messageReads, messageRecipients) },
    { label: "工单解决", value: resolvedTickets, percentage: percentage(resolvedTickets, tickets) },
  ]
  const conversionFunnel = toFunnelDistribution([
    { label: "访问", value: viewCount },
    { label: "注册", value: totalUsers },
    { label: "预申请", value: totalApplications },
    { label: "审核通过", value: approvedApplications },
    { label: "首次活跃", value: activeUsers },
    { label: "持续活跃", value: messageReads + resolvedTickets + publishedPosts },
  ])
  const dayRetention = countRetainedUsers(userRows, auditRows, now, 1)
  const weekRetention = countRetainedUsers(userRows, auditRows, now, 7)
  const monthRetention = countRetainedUsers(userRows, auditRows, now, 30)
  const retention = [
    { label: "次日留存", value: dayRetention.retained, percentage: percentage(dayRetention.retained, dayRetention.eligible) },
    { label: "7 日留存", value: weekRetention.retained, percentage: percentage(weekRetention.retained, weekRetention.eligible) },
    { label: "30 日留存", value: monthRetention.retained, percentage: percentage(monthRetention.retained, monthRetention.eligible) },
    { label: "不同来源留存对比", value: sourceAttribution.preApplicationSources[0]?.value || 0, percentage: sourceAttribution.preApplicationSources[0]?.percentage || 0 },
  ]
  const review = [
    { label: "待审核量", value: pendingApplications, percentage: percentage(pendingApplications, totalApplications) },
    { label: "通过率", value: approvedApplications, percentage: percentage(approvedApplications, processedApplications) },
    { label: "驳回率", value: rejectedApplications, percentage: percentage(rejectedApplications, processedApplications) },
    { label: "平均处理时长", value: averageReviewHours, percentage: percentage(averageReviewHours, 72) },
    { label: "管理员处理量", value: reviewRows.length, percentage: percentage(reviewRows.length, submittedApplications) },
  ]
  const security = [
    { label: "指纹重复", value: similarityEvents, percentage: percentage(similarityEvents, fingerprintEvents) },
    { label: "IP 变化", value: fingerprintEvents, percentage: 100 },
    { label: "登录失败", value: authAuditLogs, percentage: percentage(authAuditLogs, auditLogs) },
    { label: "异常申请", value: riskClusters, percentage: 100 },
    { label: "封禁", value: bannedUsers + shadowBannedUsers, percentage: percentage(bannedUsers + shadowBannedUsers, totalUsers) },
    { label: "申诉", value: appeals, percentage: percentage(appeals, totalApplications) },
  ]
  const systemHealth = [
    { label: "API 错误", value: apiErrorLogs, percentage: percentage(apiErrorLogs, auditLogs) },
    { label: "数据库异常", value: databaseExceptionLogs, percentage: percentage(databaseExceptionLogs, auditLogs) },
    { label: "后台操作量", value: adminAuditLogs, percentage: percentage(adminAuditLogs, auditLogs) },
    { label: "审计日志趋势", value: auditLogs, percentage: 100 },
  ]
  const overviewCards = [
    { label: "累计账号", value: totalUsers, helper: `${newUsers} 个近期新增` },
    { label: "活跃账号", value: activeUsers, helper: `${bannedUsers} 个封禁账号` },
    { label: "新增账号", value: newUsers, helper: `${rangeDays} 天窗口` },
    { label: "预申请数", value: totalApplications, helper: `${submittedApplications} 个近期提交` },
    { label: "通过率", value: ratioLabel(approvedApplications, processedApplications) },
    { label: "文章数", value: totalPosts, helper: `${publishedPosts} 篇已发布` },
    { label: "工单数", value: tickets, helper: `${resolvedTickets} 个近期解决` },
  ]

  const modules: StatisticModule[] = [
    {
      key: "overview",
      title: "总览",
      description: "累计账号、活跃账号、新增账号、预申请数、通过率、文章数和工单数。",
      chart: "scorecards",
      cards: overviewCards,
      rows: toDistribution(overviewCards.map((item) => ({ label: item.label, value: Number(item.value) || 0 }))),
    },
    {
      key: "source",
      title: "来源",
      description: "注册来源、OAuth 来源、预申请来源、地区、设备、浏览器和邀请来源。",
      chart: "distribution",
      cards: sourceAttribution.refererReadiness,
      rows: [
        ...registrationDistribution,
        ...sourceAttribution.oauthProviders,
        ...sourceAttribution.preApplicationSources,
        ...countryDistribution,
        ...browserDistribution,
        ...deviceDistribution,
        ...inviteDistribution,
      ].slice(0, 18),
    },
    {
      key: "conversion",
      title: "转化",
      description: "访问、注册、预申请、审核通过、首次活跃和持续活跃。",
      chart: "funnel",
      cards: [
        { label: "访问", value: viewCount },
        { label: "注册", value: totalUsers },
        { label: "审核通过", value: approvedApplications },
        { label: "持续活跃", value: messageReads + resolvedTickets + publishedPosts },
      ],
      rows: conversionFunnel,
    },
    {
      key: "retention",
      title: "留存",
      description: "次日留存、7 日留存、30 日留存和不同来源留存对比。",
      chart: "retention",
      cards: [
        { label: "次日留存", value: `${dayRetention.retained}/${dayRetention.eligible}` },
        { label: "7 日留存", value: `${weekRetention.retained}/${weekRetention.eligible}` },
        { label: "30 日留存", value: `${monthRetention.retained}/${monthRetention.eligible}` },
        { label: "来源对比", value: sourceAttribution.preApplicationSources[0]?.label || "暂无" },
      ],
      rows: retention,
    },
    {
      key: "behavior",
      title: "行为",
      description: "登录、提交预申请、创建文章、阅读站内信、发起工单和申诉。",
      chart: "ranking",
      cards: [
        { label: "登录", value: authAuditLogs },
        { label: "提交预申请", value: submittedApplications },
        { label: "创建文章", value: totalPosts },
        { label: "申诉", value: appeals },
      ],
      rows: behavior,
    },
    {
      key: "review",
      title: "审核",
      description: "待审核量、通过率、驳回率、平均处理时长和管理员处理量。",
      chart: "ranking",
      cards: [
        { label: "待审核量", value: pendingApplications },
        { label: "通过率", value: ratioLabel(approvedApplications, processedApplications) },
        { label: "驳回率", value: ratioLabel(rejectedApplications, processedApplications) },
        { label: "平均处理时长", value: `${averageReviewHours}h` },
      ],
      rows: review,
    },
    {
      key: "security",
      title: "安全",
      description: "指纹重复、IP 变化、登录失败、异常申请、封禁和申诉。",
      chart: "ranking",
      cards: [
        { label: "指纹重复", value: similarityEvents },
        { label: "登录失败", value: authAuditLogs },
        { label: "异常申请", value: riskClusters },
        { label: "封禁", value: bannedUsers + shadowBannedUsers },
      ],
      rows: security,
    },
    {
      key: "system",
      title: "系统",
      description: "API 错误、数据库异常、后台操作量和审计日志趋势。",
      chart: "trend",
      cards: [
        { label: "API 错误", value: apiErrorLogs },
        { label: "数据库异常", value: databaseExceptionLogs },
        { label: "后台操作量", value: adminAuditLogs },
        { label: "审计日志趋势", value: auditLogs },
      ],
      rows: systemHealth,
    },
  ]

  return {
    rangeDays,
    generatedAt: now.toISOString(),
    kpis: {
      operations: overviewCards.slice(0, 4),
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
    sourceAttribution,
    behavior,
    conversion,
    retention,
    review,
    security,
    systemHealth,
    aggregation: Array.from(aggregationMap.values()),
    modules,
  }
}

export async function getAdminAccountStatistics(
  db: StatisticsDb,
  userId: string,
): Promise<AdminAccountStatistics | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      accounts: { select: { provider: true, trustLevel: true, providerProfile: true } },
      preApplications: {
        select: {
          id: true,
          source: true,
          sourceDetail: true,
          status: true,
          guidance: true,
          createdAt: true,
          reviewedAt: true,
          reviewedBy: { select: { name: true, email: true } },
          adminNotes: {
            where: { deletedAt: null },
            select: { content: true, createdAt: true, createdBy: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          appeals: {
            select: { status: true, reason: true, reviewComment: true, createdAt: true, reviewedAt: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      preApplicationAppeals: {
        select: { status: true, reason: true, reviewComment: true, createdAt: true, reviewedAt: true },
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
          networkKey: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      shadowBannedEntry: { select: { reason: true, createdAt: true } },
    },
  })

  if (!user) return null

  const latestApplication = user.preApplications[0]
  const latestFingerprint = user.fingerprintEvents[0]
  const [postCount, ticketCount, auditLogs, relatedFingerprintUsers, relatedNetworkEvents] = await Promise.all([
    db.post.count({ where: { authorId: userId } }),
    db.ticket.count({ where: { userId } }),
    db.auditLog.findMany({
      where: { OR: [{ actorId: userId }, { entityType: "USER", entityId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        action: true,
        entityType: true,
        createdAt: true,
        ip: true,
        userAgent: true,
        actorName: true,
        actorEmail: true,
        actorRole: true,
      },
    }),
    latestFingerprint?.fingerprintHash
      ? db.user.findMany({
          where: { id: { not: userId }, latestFingerprintHash: latestFingerprint.fingerprintHash },
          select: { id: true, email: true, status: true, latestFingerprintAt: true },
          take: 5,
        })
      : Promise.resolve([]),
    latestFingerprint?.networkKey
      ? db.fingerprintEvent.findMany({
          where: { networkKey: latestFingerprint.networkKey, userId: { not: null } },
          select: { user: { select: { id: true, email: true, status: true, latestFingerprintAt: true } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  const readMessages = user.messageRecipients.filter((item: any) => item.readAt).length
  const activeTokens = user.apiTokens.filter((item: any) => !item.revokedAt).length
  const deviceSummary = Array.from(new Set(user.passkeyCredentials.map((item: any) => item.deviceType))).join(", ") || "Unknown"
  const browserSummary = Array.from(
    new Set(user.fingerprintEvents.map((item: any) => item.browserFamily).filter(Boolean)),
  ).join(", ") || "Unknown"
  const latestActiveAt = latestDate(
    user.latestFingerprintAt,
    auditLogs[0]?.createdAt,
    ...user.apiTokens.map((item: any) => item.lastUsedAt),
    ...user.passkeyCredentials.map((item: any) => item.lastUsedAt),
  )
  const relatedMap = new Map<string, RelatedAccountItem>()
  relatedFingerprintUsers.forEach((related: any) => {
    relatedMap.set(related.id, {
      id: related.id,
      email: maskEmail(related.email),
      status: related.status,
      reason: "相同指纹",
      lastSeenAt: related.latestFingerprintAt?.toISOString(),
    })
  })
  relatedNetworkEvents.forEach((event: any) => {
    const related = event.user
    if (!related || related.id === userId) return
    const current = relatedMap.get(related.id)
    relatedMap.set(related.id, {
      id: related.id,
      email: maskEmail(related.email),
      status: related.status,
      reason: current ? `${current.reason}、相同网络特征` : "相同网络特征",
      lastSeenAt: related.latestFingerprintAt?.toISOString(),
    })
  })

  const lifecycleTimeline: AccountTimelineItem[] = [
    { label: "注册", at: user.createdAt.toISOString(), status: user.status, helper: "账号创建" },
    ...user.preApplications.flatMap((application: any) => [
      {
        label: "提交预申请",
        at: application.createdAt.toISOString(),
        status: application.status,
        helper: application.source || "来源未记录",
      },
      ...(application.reviewedAt
        ? [
            {
              label: "审核",
              at: application.reviewedAt.toISOString(),
              status: application.status,
              helper: application.reviewedBy?.name || application.reviewedBy?.email || "处理人未记录",
            },
          ]
        : []),
    ]),
    ...user.preApplicationAppeals.map((appeal: any) => ({
      label: "申诉",
      at: appeal.createdAt.toISOString(),
      status: appeal.status,
      helper: appeal.reviewComment || appeal.reason,
    })),
    ...(user.shadowBannedEntry
      ? [
          {
            label: "封禁",
            at: user.shadowBannedEntry.createdAt.toISOString(),
            status: "SHADOW_BANNED",
            helper: user.shadowBannedEntry.reason,
          },
        ]
      : []),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const reviewLinks: AccountRecordItem[] = user.preApplications.flatMap((application: any) => [
    {
      label: `预申请 ${application.id.slice(0, 8)}`,
      value: application.status,
      helper: `${application.reviewedBy?.name || application.reviewedBy?.email || "处理人未记录"} · 备注 ${application.adminNotes.length} · 申诉 ${application.appeals.length}`,
      at: application.reviewedAt?.toISOString() || application.createdAt.toISOString(),
      badge: application.status,
    },
    ...application.adminNotes.map((note: any) => ({
      label: "审核备注",
      value: note.content.slice(0, 48),
      helper: note.createdBy?.name || note.createdBy?.email || "后台",
      at: note.createdAt.toISOString(),
      badge: "NOTE",
    })),
    ...application.appeals.map((appeal: any) => ({
      label: "申诉历史",
      value: appeal.status,
      helper: appeal.reviewComment || appeal.reason,
      at: appeal.reviewedAt?.toISOString() || appeal.createdAt.toISOString(),
      badge: appeal.status,
    })),
  ])

  const managementRecords: AccountRecordItem[] = auditLogs.map((log: any) => ({
    label: log.action,
    value: log.entityType,
    helper: log.actorName || maskEmail(log.actorEmail) || "系统记录",
    at: log.createdAt.toISOString(),
    badge: log.actorRole || "SYSTEM",
  }))

  const sourceProfile = [
    { label: "注册来源", value: user.accounts.length ? "OAuth" : "Email" },
    { label: "OAuth 绑定", value: user.accounts.map((account: any) => account.provider).join(", ") || "Direct" },
    { label: "预申请来源", value: latestApplication?.source || "Unknown" },
    { label: "地区", value: user.country || "Unknown" },
    { label: "设备摘要", value: deviceSummary },
    { label: "浏览器", value: browserSummary },
  ]
  const lifecycle = [
    { label: "注册时间", value: formatShortDate(user.createdAt) },
    { label: "最近活跃", value: latestActiveAt ? formatShortDate(latestActiveAt) : "无" },
    { label: "预申请次数", value: user.preApplications.length },
    { label: "当前申请状态", value: latestApplication?.status || "无" },
    { label: "最近审核", value: formatShortDate(latestApplication?.reviewedAt) },
  ]
  const behavior = [
    { label: "登录次数", value: user.fingerprintEvents.filter((event: any) => event.eventType === "login").length },
    { label: "文章数", value: postCount },
    { label: "站内信已读", value: readMessages, helper: `${user.messageRecipients.length} 条收件` },
    { label: "工单数", value: ticketCount },
    { label: "最近关键行为", value: auditLogs[0]?.action || "无" },
    { label: "有效 Token", value: activeTokens },
  ]
  const security = [
    { label: "最新指纹", value: maskHash(latestFingerprint?.fingerprintHash) || "无" },
    { label: "相似指纹", value: latestFingerprint?.similarityScore ?? 0 },
    { label: "IP 段变化", value: maskIp(latestFingerprint?.ip) || "无" },
    { label: "异常标记", value: user.shadowBannedEntry ? "Shadowban" : "无" },
    { label: "浏览器", value: latestFingerprint?.browserFamily || "Unknown" },
  ]

  return {
    id: user.id,
    email: maskEmail(user.email),
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    country: user.country,
    basicInfo: [
      { label: "邮箱", value: maskEmail(user.email) },
      { label: "昵称", value: user.name || "无" },
      { label: "角色", value: user.role },
      { label: "状态", value: user.status },
      { label: "创建时间", value: formatShortDate(user.createdAt) },
      { label: "最近活跃", value: latestActiveAt ? formatShortDate(latestActiveAt) : "无" },
    ],
    sourceProfile,
    lifecycleTimeline,
    sourceAttribution: sourceProfile,
    lifecycle,
    behavior,
    reviewLinks,
    security,
    relatedAccounts: Array.from(relatedMap.values()).slice(0, 8),
    managementRecords,
    auditTrail: auditLogs.map((log: any) => ({
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt.toISOString(),
      ip: maskIp(log.ip),
      userAgent: log.userAgent ? `${log.userAgent.slice(0, 80)}${log.userAgent.length > 80 ? "…" : ""}` : "",
    })),
  }
}
