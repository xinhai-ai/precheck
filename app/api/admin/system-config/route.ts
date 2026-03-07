import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isAdmin, isSuperAdmin } from "@/lib/auth/permissions"
import { writeAuditLog } from "@/lib/audit"
import {
  allowedEmailDomains as defaultEmailDomains,
  defaultQQGroups,
} from "@/lib/pre-application/constants"
import {
  DEFAULT_ESSAY_MAX_LENGTH,
  DEFAULT_ESSAY_MIN_LENGTH,
  normalizeEssayLengthLimits,
} from "@/lib/pre-application/essay-limits"
import { invalidateSiteSettingsCache } from "@/lib/site-settings"
import { invalidateSubmitLimitsCache } from "@/lib/pre-application/submit-limits"
import {
  DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
  DEFAULT_PREAPP_DAILY_USER_LIMIT,
  DEFAULT_PREAPP_SUBMIT_END_TIME,
  DEFAULT_PREAPP_SUBMIT_START_TIME,
  normalizeSubmitLimits,
  parseSubmitTimeToMinutes,
} from "@/lib/pre-application/submit-limits-utils"
import {
  normalizeAppealAutoRejectPatterns,
  PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
} from "@/lib/pre-application/appeal-utils"
import { normalizeSubmitBanDays } from "@/lib/pre-application/submit-ban-utils"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

// QQ 群配置 schema
const qqGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  number: z.string().min(5),
  url: z.string().url(),
  enabled: z.boolean(),
  adminOnly: z.boolean().optional(),
})

const systemConfigSchema = z.object({
  preApplicationEssayHint: z.string().min(10).max(500),
  preApplicationEssayMinLength: z.number().int().min(1).max(5000),
  preApplicationEssayMaxLength: z.number().int().min(1).max(5000),
  preApplicationDailyGlobalLimit: z.number().int().min(1).optional(),
  preApplicationDailyUserLimit: z.number().int().min(1).optional(),
  preApplicationSubmitStartTime: z.string().optional(),
  preApplicationSubmitEndTime: z.string().optional(),
  preApplicationAppealEnabled: z.boolean().optional(),
  preApplicationAppealAutoRejectEnabled: z.boolean().optional(),
  preApplicationAppealAutoRejectPatterns: z.array(z.string()).optional(),
  preApplicationAppealAutoRejectApplySubmitBan: z.boolean().optional(),
  preApplicationAppealAutoRejectSubmitBanDays: z.number().int().min(1).optional(),
  allowedEmailDomains: z.array(z.string().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)).min(1),
  auditLogEnabled: z.boolean().optional(),
  reviewTemplatesApprove: z.array(z.string()).optional(),
  reviewTemplatesApproveNoCode: z.array(z.string()).optional(),
  reviewTemplatesReject: z.array(z.string()).optional(),
  reviewTemplatesDispute: z.array(z.string()).optional(),
  // QQ 群配置
  qqGroups: z.array(qqGroupSchema).optional(),
  // 邀请码 URL 前缀
  inviteCodeUrlPrefix: z.string().optional(),
  // 邮件配置
  emailProvider: z.enum(["env", "api", "smtp"]).optional(),
  selectedEmailApiConfigId: z.string().optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPass: z.string().optional().nullable(),
  smtpSecure: z.boolean().optional(),
  // 驳回后最大重新提交次数（0 = 无限制）
  maxResubmitCount: z.number().int().min(0).optional(),
  // 邀请码有效期检测 API 配置
  inviteCodeCheckApiUrl: z.string().url().optional().nullable().or(z.literal("")),
  inviteCodeCheckApiKey: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // 系统配置查看需要管理员权限
    if (!user || !isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const canViewSecrets = isSuperAdmin(user.role)

    const settings = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: {
        preApplicationEssayHint: true,
        preApplicationEssayMinLength: true,
        preApplicationEssayMaxLength: true,
        preApplicationDailyGlobalLimit: true,
        preApplicationDailyUserLimit: true,
        preApplicationSubmitStartTime: true,
        preApplicationSubmitEndTime: true,
        preApplicationAppealEnabled: true,
        preApplicationAppealAutoRejectEnabled: true,
        preApplicationAppealAutoRejectPatterns: true,
        preApplicationAppealAutoRejectApplySubmitBan: true,
        preApplicationAppealAutoRejectSubmitBanDays: true,
        allowedEmailDomains: true,
        auditLogEnabled: true,
        reviewTemplatesApprove: true,
        reviewTemplatesApproveNoCode: true,
        reviewTemplatesReject: true,
        reviewTemplatesDispute: true,
        qqGroups: true,
        inviteCodeUrlPrefix: true,
        emailProvider: true,
        selectedEmailApiConfigId: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        smtpPass: true,
        smtpSecure: true,
        inviteCodeCheckApiUrl: true,
        inviteCodeCheckApiKey: true,
        maxResubmitCount: true,
      },
    })

    if (!settings) {
      return NextResponse.json({
        preApplicationEssayHint: "建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。",
        preApplicationEssayMinLength: DEFAULT_ESSAY_MIN_LENGTH,
        preApplicationEssayMaxLength: DEFAULT_ESSAY_MAX_LENGTH,
        preApplicationDailyGlobalLimit: DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
        preApplicationDailyUserLimit: DEFAULT_PREAPP_DAILY_USER_LIMIT,
        preApplicationSubmitStartTime: DEFAULT_PREAPP_SUBMIT_START_TIME,
        preApplicationSubmitEndTime: DEFAULT_PREAPP_SUBMIT_END_TIME,
        preApplicationAppealEnabled: false,
        preApplicationAppealAutoRejectEnabled: false,
        preApplicationAppealAutoRejectPatterns: [],
        preApplicationAppealAutoRejectApplySubmitBan: false,
        preApplicationAppealAutoRejectSubmitBanDays: PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
        allowedEmailDomains: defaultEmailDomains,
        auditLogEnabled: false,
        reviewTemplatesApprove: [],
        reviewTemplatesApproveNoCode: [],
        reviewTemplatesReject: [],
        reviewTemplatesDispute: [],
        qqGroups: defaultQQGroups,
        inviteCodeUrlPrefix: "",
        emailProvider: "env",
        selectedEmailApiConfigId: null,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPass: null,
        smtpSecure: false,
        inviteCodeCheckApiUrl: null,
        inviteCodeCheckApiKey: null,
        maxResubmitCount: 2,
      })
    }

    const limits = normalizeEssayLengthLimits(
      settings.preApplicationEssayMinLength,
      settings.preApplicationEssayMaxLength,
    )
    const submitLimits = normalizeSubmitLimits({
      dailyGlobalLimit: settings.preApplicationDailyGlobalLimit,
      dailyUserLimit: settings.preApplicationDailyUserLimit,
      submitStartTime: settings.preApplicationSubmitStartTime,
      submitEndTime: settings.preApplicationSubmitEndTime,
    })

    return NextResponse.json({
      preApplicationEssayHint: settings.preApplicationEssayHint,
      preApplicationEssayMinLength: limits.min,
      preApplicationEssayMaxLength: limits.max,
      preApplicationDailyGlobalLimit: submitLimits.dailyGlobalLimit,
      preApplicationDailyUserLimit: submitLimits.dailyUserLimit,
      preApplicationSubmitStartTime: submitLimits.submitStartTime,
      preApplicationSubmitEndTime: submitLimits.submitEndTime,
      preApplicationAppealEnabled: settings.preApplicationAppealEnabled ?? false,
      preApplicationAppealAutoRejectEnabled:
        settings.preApplicationAppealAutoRejectEnabled ?? false,
      preApplicationAppealAutoRejectPatterns: Array.isArray(
        settings.preApplicationAppealAutoRejectPatterns,
      )
        ? settings.preApplicationAppealAutoRejectPatterns
        : [],
      preApplicationAppealAutoRejectApplySubmitBan:
        settings.preApplicationAppealAutoRejectApplySubmitBan ?? false,
      preApplicationAppealAutoRejectSubmitBanDays:
        settings.preApplicationAppealAutoRejectSubmitBanDays ??
        PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
      allowedEmailDomains: Array.isArray(settings.allowedEmailDomains)
        ? settings.allowedEmailDomains
        : defaultEmailDomains,
      auditLogEnabled: settings.auditLogEnabled ?? false,
      reviewTemplatesApprove: Array.isArray(settings.reviewTemplatesApprove)
        ? settings.reviewTemplatesApprove
        : [],
      reviewTemplatesApproveNoCode: Array.isArray(settings.reviewTemplatesApproveNoCode)
        ? settings.reviewTemplatesApproveNoCode
        : [],
      reviewTemplatesReject: Array.isArray(settings.reviewTemplatesReject)
        ? settings.reviewTemplatesReject
        : [],
      reviewTemplatesDispute: Array.isArray(settings.reviewTemplatesDispute)
        ? settings.reviewTemplatesDispute
        : [],
      qqGroups: Array.isArray(settings.qqGroups) ? settings.qqGroups : defaultQQGroups,
      inviteCodeUrlPrefix: settings.inviteCodeUrlPrefix ?? "",
      emailProvider: settings.emailProvider ?? "env",
      selectedEmailApiConfigId: settings.selectedEmailApiConfigId,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPass: canViewSecrets ? settings.smtpPass : null,
      smtpSecure: settings.smtpSecure ?? false,
      inviteCodeCheckApiUrl: settings.inviteCodeCheckApiUrl ?? null,
      inviteCodeCheckApiKey: canViewSecrets ? (settings.inviteCodeCheckApiKey ?? null) : null,
      maxResubmitCount: settings.maxResubmitCount ?? 2,
    })
  } catch (error) {
    console.error("System config fetch error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.systemConfig.failedToFetch, {
      status: 500,
    })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    // 系统配置修改仅限超级管理员
    if (!user || !isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const data = systemConfigSchema.parse(body)
    if (data.preApplicationEssayMinLength > data.preApplicationEssayMaxLength) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: "最小字符数不能大于最大字符数" },
      })
    }

    const before = await db.siteSettings.findUnique({
      where: { id: "global" },
    })

    const submitStartTime =
      data.preApplicationSubmitStartTime ??
      before?.preApplicationSubmitStartTime ??
      DEFAULT_PREAPP_SUBMIT_START_TIME
    const submitEndTime =
      data.preApplicationSubmitEndTime ??
      before?.preApplicationSubmitEndTime ??
      DEFAULT_PREAPP_SUBMIT_END_TIME

    const startMinutes = parseSubmitTimeToMinutes(submitStartTime)
    const endMinutes = parseSubmitTimeToMinutes(submitEndTime)

    if (startMinutes === null || endMinutes === null) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: "提交时间范围格式无效，请使用 HH:mm（如 09:00）" },
      })
    }

    if (startMinutes >= endMinutes) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: "提交时间开始值必须早于结束值" },
      })
    }

    let autoRejectPatterns: string[]
    try {
      autoRejectPatterns = normalizeAppealAutoRejectPatterns(
        data.preApplicationAppealAutoRejectPatterns ??
          (Array.isArray(before?.preApplicationAppealAutoRejectPatterns)
            ? before.preApplicationAppealAutoRejectPatterns.map((value) => String(value))
            : []),
      )
    } catch (error) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: {
          detail: error instanceof Error ? error.message : "申诉自动拒绝正则无效",
        },
      })
    }

    const autoRejectSubmitBanDays =
      data.preApplicationAppealAutoRejectSubmitBanDays ??
      before?.preApplicationAppealAutoRejectSubmitBanDays ??
      PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS

    if (normalizeSubmitBanDays(autoRejectSubmitBanDays) === null) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: "申诉自动拒绝封禁天数无效" },
      })
    }

    const submitLimits = normalizeSubmitLimits({
      dailyGlobalLimit:
        data.preApplicationDailyGlobalLimit ??
        before?.preApplicationDailyGlobalLimit ??
        DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
      dailyUserLimit:
        data.preApplicationDailyUserLimit ??
        before?.preApplicationDailyUserLimit ??
        DEFAULT_PREAPP_DAILY_USER_LIMIT,
      submitStartTime,
      submitEndTime,
    })

    const updated = await db.siteSettings.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        siteName: "预申请系统",
        siteDescription: "社区预申请与邀请码管理系统",
        contactEmail: "admin@example.com",
        preApplicationEssayHint: data.preApplicationEssayHint,
        preApplicationEssayMinLength: data.preApplicationEssayMinLength,
        preApplicationEssayMaxLength: data.preApplicationEssayMaxLength,
        preApplicationDailyGlobalLimit: submitLimits.dailyGlobalLimit,
        preApplicationDailyUserLimit: submitLimits.dailyUserLimit,
        preApplicationSubmitStartTime: submitLimits.submitStartTime,
        preApplicationSubmitEndTime: submitLimits.submitEndTime,
        preApplicationAppealEnabled: data.preApplicationAppealEnabled ?? false,
        preApplicationAppealAutoRejectEnabled:
          data.preApplicationAppealAutoRejectEnabled ?? false,
        preApplicationAppealAutoRejectPatterns: autoRejectPatterns,
        preApplicationAppealAutoRejectApplySubmitBan:
          data.preApplicationAppealAutoRejectApplySubmitBan ?? false,
        preApplicationAppealAutoRejectSubmitBanDays: autoRejectSubmitBanDays,
        allowedEmailDomains: data.allowedEmailDomains,
        auditLogEnabled: data.auditLogEnabled ?? false,
        reviewTemplatesApprove: data.reviewTemplatesApprove ?? [],
        reviewTemplatesApproveNoCode: data.reviewTemplatesApproveNoCode ?? [],
        reviewTemplatesReject: data.reviewTemplatesReject ?? [],
        reviewTemplatesDispute: data.reviewTemplatesDispute ?? [],
        qqGroups: data.qqGroups ?? defaultQQGroups,
        inviteCodeUrlPrefix: data.inviteCodeUrlPrefix ?? "",
        emailProvider: data.emailProvider ?? "env",
        selectedEmailApiConfig: data.selectedEmailApiConfigId
          ? { connect: { id: data.selectedEmailApiConfigId } }
          : undefined,
        smtpHost: data.smtpHost ?? null,
        smtpPort: data.smtpPort ?? null,
        smtpUser: data.smtpUser ?? null,
        smtpPass: data.smtpPass ?? null,
        smtpSecure: data.smtpSecure ?? false,
        inviteCodeCheckApiUrl: data.inviteCodeCheckApiUrl || null,
        inviteCodeCheckApiKey: data.inviteCodeCheckApiKey ?? null,
        maxResubmitCount: data.maxResubmitCount ?? 2,
      },
      update: {
        preApplicationEssayHint: data.preApplicationEssayHint,
        preApplicationEssayMinLength: data.preApplicationEssayMinLength,
        preApplicationEssayMaxLength: data.preApplicationEssayMaxLength,
        preApplicationDailyGlobalLimit: submitLimits.dailyGlobalLimit,
        preApplicationDailyUserLimit: submitLimits.dailyUserLimit,
        preApplicationSubmitStartTime: submitLimits.submitStartTime,
        preApplicationSubmitEndTime: submitLimits.submitEndTime,
        ...(data.preApplicationAppealEnabled !== undefined && {
          preApplicationAppealEnabled: data.preApplicationAppealEnabled,
        }),
        ...(data.preApplicationAppealAutoRejectEnabled !== undefined && {
          preApplicationAppealAutoRejectEnabled: data.preApplicationAppealAutoRejectEnabled,
        }),
        ...(data.preApplicationAppealAutoRejectPatterns !== undefined && {
          preApplicationAppealAutoRejectPatterns: autoRejectPatterns,
        }),
        ...(data.preApplicationAppealAutoRejectApplySubmitBan !== undefined && {
          preApplicationAppealAutoRejectApplySubmitBan:
            data.preApplicationAppealAutoRejectApplySubmitBan,
        }),
        ...(data.preApplicationAppealAutoRejectSubmitBanDays !== undefined && {
          preApplicationAppealAutoRejectSubmitBanDays: autoRejectSubmitBanDays,
        }),
        allowedEmailDomains: data.allowedEmailDomains,
        ...(data.auditLogEnabled !== undefined && { auditLogEnabled: data.auditLogEnabled }),
        ...(data.reviewTemplatesApprove !== undefined && {
          reviewTemplatesApprove: data.reviewTemplatesApprove,
        }),
        ...(data.reviewTemplatesApproveNoCode !== undefined && {
          reviewTemplatesApproveNoCode: data.reviewTemplatesApproveNoCode,
        }),
        ...(data.reviewTemplatesReject !== undefined && {
          reviewTemplatesReject: data.reviewTemplatesReject,
        }),
        ...(data.reviewTemplatesDispute !== undefined && {
          reviewTemplatesDispute: data.reviewTemplatesDispute,
        }),
        ...(data.qqGroups !== undefined && { qqGroups: data.qqGroups }),
        ...(data.inviteCodeUrlPrefix !== undefined && {
          inviteCodeUrlPrefix: data.inviteCodeUrlPrefix,
        }),
        ...(data.emailProvider !== undefined && { emailProvider: data.emailProvider }),
        ...(data.selectedEmailApiConfigId !== undefined && {
          selectedEmailApiConfigId: data.selectedEmailApiConfigId,
        }),
        ...(data.smtpHost !== undefined && { smtpHost: data.smtpHost }),
        ...(data.smtpPort !== undefined && { smtpPort: data.smtpPort }),
        ...(data.smtpUser !== undefined && { smtpUser: data.smtpUser }),
        ...(data.smtpPass !== undefined && { smtpPass: data.smtpPass }),
        ...(data.smtpSecure !== undefined && { smtpSecure: data.smtpSecure }),
        ...(data.inviteCodeCheckApiUrl !== undefined && {
          inviteCodeCheckApiUrl: data.inviteCodeCheckApiUrl || null,
        }),
        ...(data.inviteCodeCheckApiKey !== undefined && {
          inviteCodeCheckApiKey: data.inviteCodeCheckApiKey,
        }),
        ...(data.maxResubmitCount !== undefined && { maxResubmitCount: data.maxResubmitCount }),
      },
    })

    await writeAuditLog(db, {
      action: "SYSTEM_CONFIG_UPDATE",
      entityType: "SITE_SETTINGS",
      entityId: "global",
      actor: user,
      before,
      after: updated,
      metadata: {
        fields: [
          "preApplicationEssayHint",
          "preApplicationEssayMinLength",
          "preApplicationEssayMaxLength",
          "preApplicationDailyGlobalLimit",
          "preApplicationDailyUserLimit",
          "preApplicationSubmitStartTime",
          "preApplicationSubmitEndTime",
          "preApplicationAppealEnabled",
          "preApplicationAppealAutoRejectEnabled",
          "preApplicationAppealAutoRejectPatterns",
          "preApplicationAppealAutoRejectApplySubmitBan",
          "preApplicationAppealAutoRejectSubmitBanDays",
          "allowedEmailDomains",
          "auditLogEnabled",
          "reviewTemplatesApprove",
          "reviewTemplatesApproveNoCode",
          "reviewTemplatesReject",
          "reviewTemplatesDispute",
          "qqGroups",
          "inviteCodeUrlPrefix",
          "emailProvider",
          "selectedEmailApiConfigId",
          "smtpHost",
          "smtpPort",
          "smtpUser",
          "smtpSecure",
          "inviteCodeCheckApiUrl",
          "inviteCodeCheckApiKey",
          "maxResubmitCount",
        ],
      },
      request,
    })

    await invalidateSiteSettingsCache()
    await invalidateSubmitLimitsCache()

    return NextResponse.json({
      preApplicationEssayHint: updated.preApplicationEssayHint,
      preApplicationEssayMinLength: updated.preApplicationEssayMinLength,
      preApplicationEssayMaxLength: updated.preApplicationEssayMaxLength,
      preApplicationDailyGlobalLimit: updated.preApplicationDailyGlobalLimit,
      preApplicationDailyUserLimit: updated.preApplicationDailyUserLimit,
      preApplicationSubmitStartTime: updated.preApplicationSubmitStartTime,
      preApplicationSubmitEndTime: updated.preApplicationSubmitEndTime,
      preApplicationAppealEnabled: updated.preApplicationAppealEnabled,
      preApplicationAppealAutoRejectEnabled: updated.preApplicationAppealAutoRejectEnabled,
      preApplicationAppealAutoRejectPatterns: updated.preApplicationAppealAutoRejectPatterns,
      preApplicationAppealAutoRejectApplySubmitBan:
        updated.preApplicationAppealAutoRejectApplySubmitBan,
      preApplicationAppealAutoRejectSubmitBanDays:
        updated.preApplicationAppealAutoRejectSubmitBanDays,
      allowedEmailDomains: updated.allowedEmailDomains,
      auditLogEnabled: updated.auditLogEnabled,
      reviewTemplatesApprove: updated.reviewTemplatesApprove,
      reviewTemplatesApproveNoCode: updated.reviewTemplatesApproveNoCode,
      reviewTemplatesReject: updated.reviewTemplatesReject,
      reviewTemplatesDispute: updated.reviewTemplatesDispute,
      qqGroups: updated.qqGroups,
      inviteCodeUrlPrefix: updated.inviteCodeUrlPrefix,
      emailProvider: updated.emailProvider,
      selectedEmailApiConfigId: updated.selectedEmailApiConfigId,
      smtpHost: updated.smtpHost,
      smtpPort: updated.smtpPort,
      smtpUser: updated.smtpUser,
      smtpPass: null,
      smtpSecure: updated.smtpSecure,
      inviteCodeCheckApiUrl: updated.inviteCodeCheckApiUrl,
      inviteCodeCheckApiKey: null,
      smtpPassConfigured: Boolean(updated.smtpPass),
      inviteCodeCheckApiKeyConfigured: Boolean(updated.inviteCodeCheckApiKey),
      maxResubmitCount: updated.maxResubmitCount,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }
    console.error("System config update error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.systemConfig.failedToUpdate, {
      status: 500,
    })
  }
}
