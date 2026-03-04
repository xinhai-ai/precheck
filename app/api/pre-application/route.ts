import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { writeAuditLog } from "@/lib/audit"
import { isAllowedEmailDomainAsync, normalizeEmail } from "@/lib/pre-application/validation"
import { getEssayLengthLimits } from "@/lib/pre-application/essay-limits"
import { PreApplicationSource, PreApplicationStatus } from "@prisma/client"
import { randomBytes } from "crypto"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { getQQGroups } from "@/lib/qq-groups"
import { getRedisClient } from "@/lib/redis"
import { parseFingerprintPayload } from "@/lib/fingerprint/payload"
import { recordFingerprintEvent } from "@/lib/fingerprint/server"
import {
  mapStatusForUserView,
  SHADOW_HIDDEN_STATUS,
  shouldPersistAsShadowHidden,
} from "@/lib/pre-application/shadowban"
import {
  getShanghaiDayQuotaInfo,
  isWithinShanghaiSubmitWindow,
} from "@/lib/pre-application/submit-limits-utils"
import { getPreApplicationSubmitLimits } from "@/lib/pre-application/submit-limits"
import { consumePreApplicationSubmitQuota } from "@/lib/pre-application/submit-quota"

async function generateUniqueQueryToken(): Promise<string> {
  if (!db) throw new Error("Database not configured")
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(4).toString("hex").toUpperCase()
    const existing = await db.preApplication.findUnique({ where: { queryToken: token } })
    if (!existing) return token
  }
  return randomBytes(6).toString("hex").toUpperCase()
}

async function getMaxResubmitCount(): Promise<number> {
  if (!db) return 2
  const settings = await db.siteSettings.findUnique({
    where: { id: "global" },
    select: { maxResubmitCount: true },
  })
  return settings?.maxResubmitCount ?? 2
}

async function isUserShadowBanned(userId: string): Promise<boolean> {
  if (!db) return false
  const shadow = await db.shadowBannedUser.findUnique({
    where: { userId },
    select: { userId: true },
  })
  return Boolean(shadow)
}

const preApplicationSchema = z.object({
  essay: z.string(),
  source: z.nativeEnum(PreApplicationSource).optional().nullable(),
  sourceDetail: z.string().max(100).optional().nullable(),
  registerEmail: z.string().email(),
  group: z.string().min(1), // 动态群 ID，由 QQ 群配置决定
  version: z.number().optional(), // 乐观锁版本号
})

// 验证群 ID 是否在配置中
async function isValidGroupId(groupId: string): Promise<boolean> {
  const groups = await getQQGroups()
  return groups.some((g) => g.id === groupId)
}

async function enforcePreApplicationSubmitLimits(
  request: NextRequest,
  identity: string,
): Promise<NextResponse | null> {
  const limits = await getPreApplicationSubmitLimits()
  const now = new Date()

  if (!isWithinShanghaiSubmitWindow(now, limits.submitStartTime, limits.submitEndTime)) {
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.submitWindowClosed, {
      status: 403,
      meta: {
        detail: `当前仅允许在 ${limits.submitStartTime}-${limits.submitEndTime}（Asia/Shanghai）提交`,
      },
    })
  }

  const quotaInfo = getShanghaiDayQuotaInfo(now)
  const quotaResult = await consumePreApplicationSubmitQuota({
    identity,
    dayKey: quotaInfo.dayKey,
    ttlSeconds: quotaInfo.ttlSeconds,
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
  })

  if (quotaResult.ok) {
    return null
  }

  if (quotaResult.reason === "user_limit_exceeded") {
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.dailyUserLimitExceeded, {
      status: 429,
      meta: { detail: `每日最多提交 ${limits.dailyUserLimit} 次` },
    })
  }

  if (quotaResult.reason === "global_limit_exceeded") {
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.dailyGlobalLimitExceeded, {
      status: 429,
      meta: { detail: `全站每日提交上限为 ${limits.dailyGlobalLimit} 次` },
    })
  }

  return createApiErrorResponse(request, ApiErrorKeys.preApplication.submitRateServiceUnavailable, {
    status: 503,
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const records = await db.preApplication.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
        inviteCode: {
          select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 10,
        },
      },
    })

    const recordsForUserView = records.map((record) => ({
      ...record,
      status: mapStatusForUserView(record.status, record.versions[0]?.status),
      versions: record.versions.map((version) => ({
        ...version,
        status: mapStatusForUserView(version.status),
      })),
    }))

    // 获取排队信息
    let queueInfo = null
    const latest = records[0]
    const latestForUserView = recordsForUserView[0]
    if (latest && latestForUserView && latestForUserView.status === "PENDING") {
      const pendingLikeStatuses: PreApplicationStatus[] = [
        PreApplicationStatus.PENDING,
        SHADOW_HIDDEN_STATUS,
      ]
      // 统计所有待审核的数量
      const totalPending = await db.preApplication.count({
        where: { status: { in: pendingLikeStatuses } },
      })
      // 统计在当前用户之前的待审核数量（按创建时间排序）
      const aheadCount = await db.preApplication.count({
        where: {
          status: { in: pendingLikeStatuses },
          createdAt: { lt: latest.createdAt },
        },
      })
      queueInfo = {
        totalPending,
        position: aheadCount + 1, // 自己的位置
        aheadCount,
      }
    }

    return NextResponse.json({
      records: recordsForUserView,
      latest: recordsForUserView[0] ?? null,
      maxResubmitCount: await getMaxResubmitCount(),
      queueInfo,
    })
  } catch (error) {
    console.error("Pre-application fetch error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToFetch, {
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const data = preApplicationSchema.parse(body)
    const fingerprintPayload = parseFingerprintPayload(body)
    const registerEmail = normalizeEmail(data.registerEmail)
    const essay = data.essay.trim()

    const essayLengthLimits = await getEssayLengthLimits()

    if (essay.length < essayLengthLimits.min) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.essayTooShort, {
        status: 400,
      })
    }

    if (essay.length > essayLengthLimits.max) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.essayTooLong, {
        status: 400,
      })
    }

    if (!(await isAllowedEmailDomainAsync(registerEmail))) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.invalidEmailDomain, {
        status: 400,
      })
    }

    if (data.source === "OTHER" && !data.sourceDetail?.trim()) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.sourceDetailRequired, {
        status: 400,
      })
    }

    // 验证群 ID 是否有效
    if (!(await isValidGroupId(data.group))) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.invalidGroup, {
        status: 400,
      })
    }

    const existingCount = await db.preApplication.count({
      where: { userId: user.id },
    })

    if (existingCount > 0) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.alreadySubmitted, {
        status: 409,
      })
    }

    const limitError = await enforcePreApplicationSubmitLimits(request, `user:${user.id}`)
    if (limitError) {
      return limitError
    }

    const shadowBanned = await isUserShadowBanned(user.id)
    const persistedStatus = shouldPersistAsShadowHidden(shadowBanned)

    // 在事务外部生成 queryToken，避免 pgBouncer 兼容性问题
    const queryToken = await generateUniqueQueryToken()

    // 使用事务创建预申请和版本记录
    const record = await db.$transaction(async (tx) => {
      const preApp = await tx.preApplication.create({
        data: {
          userId: user.id,
          essay,
          source: data.source ?? null,
          sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
          registerEmail,
          queryToken,
          group: data.group,
          status: persistedStatus,
          version: 1,
          resubmitCount: 0,
        },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true } },
          inviteCode: {
            select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
          },
        },
      })

      // 创建版本历史
      await tx.preApplicationVersion.create({
        data: {
          preApplicationId: preApp.id,
          version: 1,
          essay,
          source: data.source ?? null,
          sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
          registerEmail,
          group: data.group,
          status: persistedStatus,
        },
      })

      return preApp
    })

    await writeAuditLog(db, {
      action: "PRE_APPLICATION_SUBMIT",
      entityType: "PRE_APPLICATION",
      entityId: record.id,
      actor: user,
      after: record,
      metadata: { payload: data, version: 1 },
      request,
    })

    await recordFingerprintEvent({
      db,
      eventType: "PRE_APPLICATION_SUBMIT",
      payload: fingerprintPayload,
      request,
      userId: user.id,
      preApplicationId: record.id,
    })

    return NextResponse.json({
      record: {
        ...record,
        status: mapStatusForUserView(record.status),
      },
      maxResubmitCount: await getMaxResubmitCount(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }
    console.error("Pre-application submit error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToSubmit, {
      status: 500,
    })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    // 5 分钟内只能修改一次
    const redis = getRedisClient()
    if (redis) {
      const key = `pre-app:edit-rate:${user.id}`
      const set = await redis.set(key, "1", "EX", 300, "NX")
      if (set !== "OK") {
        const ttl = await redis.ttl(key)
        const wait = ttl > 0 ? ttl : 300
        const mins = Math.floor(wait / 60)
        const secs = wait % 60
        const detail = mins > 0 ? `请 ${mins} 分 ${secs} 秒后再试` : `请 ${secs} 秒后再试`
        return createApiErrorResponse(request, ApiErrorKeys.preApplication.editTooFrequent, {
          status: 429,
          meta: { detail, waitSeconds: wait },
        })
      }
    }

    const body = await request.json()
    const data = preApplicationSchema.parse(body)
    const fingerprintPayload = parseFingerprintPayload(body)
    const registerEmail = normalizeEmail(data.registerEmail)
    const essay = data.essay.trim()

    const essayLengthLimits = await getEssayLengthLimits()

    if (essay.length < essayLengthLimits.min) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.essayTooShort, {
        status: 400,
      })
    }

    if (essay.length > essayLengthLimits.max) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.essayTooLong, {
        status: 400,
      })
    }

    if (!(await isAllowedEmailDomainAsync(registerEmail))) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.invalidEmailDomain, {
        status: 400,
      })
    }

    if (data.source === "OTHER" && !data.sourceDetail?.trim()) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.sourceDetailRequired, {
        status: 400,
      })
    }

    // 验证群 ID 是否有效
    if (!(await isValidGroupId(data.group))) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.invalidGroup, {
        status: 400,
      })
    }

    const latest = await db.preApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, version: true, resubmitCount: true },
    })

    if (!latest) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.noPreApplicationFound, {
        status: 404,
      })
    }

    if (latest.status === "APPROVED") {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.alreadyApproved, {
        status: 400,
      })
    }

    // 乐观锁检查
    if (data.version !== undefined && data.version !== latest.version) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.versionConflict, {
        status: 409,
        meta: { detail: "数据已被修改，请刷新后重试" },
      })
    }

    // 驳回后重新提交次数检查
    const maxResubmitCount = await getMaxResubmitCount()
    const isResubmit = latest.status === "REJECTED"
    if (maxResubmitCount > 0 && isResubmit && latest.resubmitCount >= maxResubmitCount) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.resubmitLimitExceeded, {
        status: 400,
        meta: {
          detail: `已达到最大重新提交次数限制 (${maxResubmitCount} 次)`,
        },
      })
    }

    const limitError = await enforcePreApplicationSubmitLimits(request, `user:${user.id}`)
    if (limitError) {
      return limitError
    }

    const newVersion = latest.version + 1
    const newResubmitCount = isResubmit ? latest.resubmitCount + 1 : latest.resubmitCount
    const shadowBanned = await isUserShadowBanned(user.id)
    const persistedStatus = shouldPersistAsShadowHidden(
      shadowBanned || latest.status === SHADOW_HIDDEN_STATUS,
    )

    const payload = {
      essay,
      source: data.source ?? null,
      sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
      registerEmail,
      group: data.group,
    }

    const before = await db.preApplication.findUnique({
      where: { id: latest.id },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
        inviteCode: {
          select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
        },
      },
    })

    // 使用事务更新预申请和创建版本记录
    const record = await db.$transaction(async (tx) => {
      const updated = await tx.preApplication.update({
        where: { id: latest.id },
        data: {
          ...payload,
          status: persistedStatus,
          guidance: null,
          reviewedAt: null,
          reviewedById: null,
          inviteCodeId: null,
          version: newVersion,
          resubmitCount: newResubmitCount,
        },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true } },
          inviteCode: {
            select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
          },
        },
      })

      // 创建版本历史
      await tx.preApplicationVersion.create({
        data: {
          preApplicationId: updated.id,
          version: newVersion,
          essay,
          source: data.source ?? null,
          sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
          registerEmail,
          group: data.group,
          status: persistedStatus,
        },
      })

      return updated
    })

    await writeAuditLog(db, {
      action: isResubmit ? "PRE_APPLICATION_RESUBMIT" : "PRE_APPLICATION_UPDATE",
      entityType: "PRE_APPLICATION",
      entityId: record.id,
      actor: user,
      before,
      after: record,
      metadata: {
        payload,
        version: newVersion,
        resubmitCount: newResubmitCount,
        isResubmit,
      },
      request,
    })

    await recordFingerprintEvent({
      db,
      eventType: "PRE_APPLICATION_SUBMIT",
      payload: fingerprintPayload,
      request,
      userId: user.id,
      preApplicationId: record.id,
    })

    return NextResponse.json({
      record: {
        ...record,
        status: mapStatusForUserView(record.status),
      },
      maxResubmitCount: maxResubmitCount,
      remainingResubmits: maxResubmitCount === 0 ? -1 : maxResubmitCount - newResubmitCount,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }
    console.error("Pre-application update error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToUpdate, {
      status: 500,
    })
  }
}

// 管理员删除自己的预申请记录（用于测试）
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    // 仅 ADMIN 和 SUPER_ADMIN 可以删除
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    // 查找当前用户的预申请记录
    const records = await db.preApplication.findMany({
      where: { userId: user.id },
      select: { id: true },
    })

    if (records.length === 0) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.noPreApplicationFound, {
        status: 404,
      })
    }

    const recordIds = records.map((r) => r.id)

    // 使用事务删除预申请及其版本历史
    await db.$transaction(async (tx) => {
      // 先删除版本历史
      await tx.preApplicationVersion.deleteMany({
        where: { preApplicationId: { in: recordIds } },
      })
      // 再删除预申请记录
      await tx.preApplication.deleteMany({
        where: { userId: user.id },
      })
    })

    await writeAuditLog(db, {
      action: "PRE_APPLICATION_DELETE_SELF",
      entityType: "PRE_APPLICATION",
      entityId: recordIds.join(","),
      actor: user,
      metadata: { deletedCount: records.length, reason: "admin_self_delete_for_testing" },
      request,
    })

    return NextResponse.json({ success: true, deletedCount: records.length })
  } catch (error) {
    console.error("Pre-application delete error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToDelete, {
      status: 500,
    })
  }
}
