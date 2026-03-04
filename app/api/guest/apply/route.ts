import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { isAllowedEmailDomainAsync, normalizeEmail } from "@/lib/pre-application/validation"
import { getEssayLengthLimits } from "@/lib/pre-application/essay-limits"
import { PreApplicationSource } from "@prisma/client"
import { randomBytes } from "crypto"
import { getQQVerifyStatus, QQ_VERIFY_CONFIG } from "@/lib/qq-verify"
import { fetchQQGroups } from "@/lib/qq-groups"
import { getPreApplicationSubmitLimits } from "@/lib/pre-application/submit-limits"
import {
  getShanghaiDayQuotaInfo,
  isWithinShanghaiSubmitWindow,
} from "@/lib/pre-application/submit-limits-utils"
import {
  consumePreApplicationSubmitQuota,
  getPreApplicationSubmitQuotaSnapshot,
} from "@/lib/pre-application/submit-quota"

async function generateUniqueQueryToken(): Promise<string> {
  if (!db) throw new Error("Database not configured")
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(4).toString("hex").toUpperCase()
    const existing = await db.preApplication.findUnique({ where: { queryToken: token } })
    if (!existing) return token
  }
  return randomBytes(6).toString("hex").toUpperCase()
}

const guestApplicationSchema = z.object({
  essay: z.string(),
  source: z.nativeEnum(PreApplicationSource).optional().nullable(),
  sourceDetail: z.string().max(100).optional().nullable(),
  registerEmail: z.string().email(),
  group: z.string().min(1),
})

async function isValidGroupId(groupId: string): Promise<boolean> {
  const groups = await fetchQQGroups()
  return groups.some((g) => g.id === groupId)
}

async function enforceGuestSubmitLimits(qqNumber: string): Promise<NextResponse | null> {
  const limits = await getPreApplicationSubmitLimits()
  const now = new Date()

  if (!isWithinShanghaiSubmitWindow(now, limits.submitStartTime, limits.submitEndTime)) {
    return NextResponse.json(
      {
        error: `当前仅允许在 ${limits.submitStartTime}-${limits.submitEndTime}（Asia/Shanghai）提交`,
      },
      { status: 403 },
    )
  }

  const quotaInfo = getShanghaiDayQuotaInfo(now)
  const quotaResult = await consumePreApplicationSubmitQuota({
    identity: `qq:${qqNumber}`,
    dayKey: quotaInfo.dayKey,
    ttlSeconds: quotaInfo.ttlSeconds,
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
  })

  if (quotaResult.ok) {
    return null
  }

  if (quotaResult.reason === "user_limit_exceeded") {
    return NextResponse.json({ error: `每日最多提交 ${limits.dailyUserLimit} 次` }, { status: 429 })
  }

  if (quotaResult.reason === "global_limit_exceeded") {
    return NextResponse.json(
      { error: `今日提交量已达上限（${limits.dailyGlobalLimit}）` },
      { status: 429 },
    )
  }

  return NextResponse.json({ error: "提交限流服务不可用，请稍后重试" }, { status: 503 })
}

async function getGuestSubmitQuotaStatus(qqNumber: string) {
  const limits = await getPreApplicationSubmitLimits()
  const now = new Date()
  const quotaInfo = getShanghaiDayQuotaInfo(now)
  const isWithinSubmitWindow = isWithinShanghaiSubmitWindow(
    now,
    limits.submitStartTime,
    limits.submitEndTime,
  )
  const snapshot = await getPreApplicationSubmitQuotaSnapshot({
    identity: `qq:${qqNumber}`,
    dayKey: quotaInfo.dayKey,
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
  })

  if (!snapshot.ok) {
    return {
      dailyGlobalLimit: limits.dailyGlobalLimit,
      dailyUserLimit: limits.dailyUserLimit,
      submitStartTime: limits.submitStartTime,
      submitEndTime: limits.submitEndTime,
      isWithinSubmitWindow,
      quotaServiceAvailable: false,
      userUsedToday: null,
      userRemainingToday: null,
      globalUsedToday: null,
      globalRemainingToday: null,
    }
  }

  return {
    dailyGlobalLimit: limits.dailyGlobalLimit,
    dailyUserLimit: limits.dailyUserLimit,
    submitStartTime: limits.submitStartTime,
    submitEndTime: limits.submitEndTime,
    isWithinSubmitWindow,
    quotaServiceAvailable: true,
    userUsedToday: snapshot.userUsedToday,
    userRemainingToday: snapshot.userRemainingToday,
    globalUsedToday: snapshot.globalUsedToday,
    globalRemainingToday: snapshot.globalRemainingToday,
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(QQ_VERIFY_CONFIG.cookieName)?.value
    const { verified, qqNumber } = await getQQVerifyStatus(token)

    if (!verified || !qqNumber) {
      return NextResponse.json({ error: "QQ 验证未通过" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "无效的请求数据" }, { status: 400 })
    }

    let data
    try {
      data = guestApplicationSchema.parse(body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "数据格式错误", detail: err.errors[0].message },
          { status: 400 },
        )
      }
      throw err
    }

    const registerEmail = normalizeEmail(data.registerEmail)
    const essay = data.essay.trim()
    const essayLengthLimits = await getEssayLengthLimits()

    if (essay.length < essayLengthLimits.min) {
      return NextResponse.json(
        { error: `申请内容不少于 ${essayLengthLimits.min} 个字符` },
        { status: 400 },
      )
    }

    if (essay.length > essayLengthLimits.max) {
      return NextResponse.json(
        { error: `申请内容最多 ${essayLengthLimits.max} 个字符` },
        { status: 400 },
      )
    }

    if (!(await isAllowedEmailDomainAsync(registerEmail))) {
      return NextResponse.json({ error: "不支持该邮箱域名" }, { status: 400 })
    }

    if (data.source === "OTHER" && !data.sourceDetail?.trim()) {
      return NextResponse.json({ error: "请填写来源说明" }, { status: 400 })
    }

    if (!(await isValidGroupId(data.group))) {
      return NextResponse.json({ error: "无效的群组" }, { status: 400 })
    }

    const existingByQQ = await db.preApplication.count({ where: { qqNumber } })
    if (existingByQQ > 0) {
      return NextResponse.json({ error: "该 QQ 号已经提交过申请" }, { status: 409 })
    }

    const limitError = await enforceGuestSubmitLimits(qqNumber)
    if (limitError) {
      return limitError
    }

    const queryToken = await generateUniqueQueryToken()

    let record
    try {
      record = await db.$transaction(async (tx) => {
        // 在事务中检查，防止竞态条件
        const existing = await tx.preApplication.count({ where: { qqNumber } })
        if (existing > 0) {
          throw new Error("DUPLICATE_QQ")
        }

        const preApp = await tx.preApplication.create({
          data: {
            qqNumber,
            essay,
            source: data.source ?? null,
            sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
            registerEmail,
            queryToken,
            group: data.group,
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

        await tx.preApplicationVersion.create({
          data: {
            preApplicationId: preApp.id,
            version: 1,
            essay,
            source: data.source ?? null,
            sourceDetail: data.source === "OTHER" ? data.sourceDetail?.trim() || null : null,
            registerEmail,
            group: data.group,
            status: "PENDING",
          },
        })

        return preApp
      })
    } catch (err) {
      if (err instanceof Error && err.message === "DUPLICATE_QQ") {
        return NextResponse.json({ error: "该 QQ 号已经提交过申请" }, { status: 409 })
      }
      throw err
    }

    await writeAuditLog(db, {
      action: "GUEST_PRE_APPLICATION_SUBMIT",
      entityType: "PRE_APPLICATION",
      entityId: record.id,
      actor: { id: null, name: `QQ:${qqNumber}`, email: registerEmail },
      after: record,
      metadata: { qqNumber, payload: data, version: 1 },
      request,
    })

    return NextResponse.json({
      success: true,
      queryToken: record.queryToken,
      submitQuotaStatus: await getGuestSubmitQuotaStatus(qqNumber),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "数据格式错误", detail: error.errors[0].message },
        { status: 400 },
      )
    }
    console.error("Guest application submit error:", error)
    return NextResponse.json({ error: "提交失败" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(QQ_VERIFY_CONFIG.cookieName)?.value
    const { verified, qqNumber } = await getQQVerifyStatus(token)

    if (!verified || !qqNumber) {
      return NextResponse.json({ error: "QQ 验证未通过" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const record = await db.preApplication.findFirst({
      where: { qqNumber },
      orderBy: { createdAt: "desc" },
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
        inviteCode: {
          select: { id: true, code: true, expiresAt: true, usedAt: true, assignedAt: true },
        },
      },
    })

    return NextResponse.json({
      record,
      submitQuotaStatus: await getGuestSubmitQuotaStatus(qqNumber),
    })
  } catch (error) {
    console.error("Guest application fetch error:", error)
    return NextResponse.json({ error: "查询失败" }, { status: 500 })
  }
}
