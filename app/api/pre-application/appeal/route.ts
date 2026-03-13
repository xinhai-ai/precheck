import { type NextRequest, NextResponse } from "next/server"
import {
  Prisma,
  PreApplicationAppealSource,
  PreApplicationAppealStatus,
} from "@prisma/client"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { db } from "@/lib/db"
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import {
  findMatchingAppealAutoRejectPattern,
  getAppealRejectSubmitBanUntil,
  getPreApplicationAppealAvailability,
  PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
} from "@/lib/pre-application/appeal-utils"

const createPreApplicationAppealSchema = z.object({
  preApplicationId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2000),
  locale: z.string().optional(),
})

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const

const appealSelect = {
  id: true,
  preApplicationId: true,
  userId: true,
  source: true,
  initiatedById: true,
  status: true,
  reason: true,
  reviewedAt: true,
  reviewComment: true,
  submitBanApplied: true,
  submitBanDays: true,
  submitBanUntil: true,
  autoRejected: true,
  autoRejectedPattern: true,
  createdAt: true,
  updatedAt: true,
  initiatedBy: { select: userSelect },
  reviewedBy: { select: userSelect },
} as const

const preApplicationWithAppealsSelect = {
  id: true,
  status: true,
  guidance: true,
  queryToken: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: { select: userSelect },
  appeals: {
    orderBy: { createdAt: "desc" as const },
    select: appealSelect,
  },
} as const

interface PreApplicationAppealSettings {
  appealEnabled: boolean
  autoRejectEnabled: boolean
  autoRejectPatterns: string[]
  autoRejectApplySubmitBan: boolean
  autoRejectSubmitBanDays: number
}

async function getPreApplicationAppealSettings(): Promise<PreApplicationAppealSettings> {
  if (!db) {
    return {
      appealEnabled: false,
      autoRejectEnabled: false,
      autoRejectPatterns: [],
      autoRejectApplySubmitBan: false,
      autoRejectSubmitBanDays: PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
    }
  }

  const settings = await db.siteSettings.findUnique({
    where: { id: "global" },
    select: {
      preApplicationAppealEnabled: true,
      preApplicationAppealAutoRejectEnabled: true,
      preApplicationAppealAutoRejectPatterns: true,
      preApplicationAppealAutoRejectApplySubmitBan: true,
      preApplicationAppealAutoRejectSubmitBanDays: true,
    },
  })

  return {
    appealEnabled: settings?.preApplicationAppealEnabled ?? false,
    autoRejectEnabled: settings?.preApplicationAppealAutoRejectEnabled ?? false,
    autoRejectPatterns: Array.isArray(settings?.preApplicationAppealAutoRejectPatterns)
      ? settings!.preApplicationAppealAutoRejectPatterns.map((value) => String(value))
      : [],
    autoRejectApplySubmitBan: settings?.preApplicationAppealAutoRejectApplySubmitBan ?? false,
    autoRejectSubmitBanDays:
      settings?.preApplicationAppealAutoRejectSubmitBanDays ?? PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
  }
}

function getAppealAvailability(
  appealEnabled: boolean,
  preApplication: {
    status: string
    appeals: Array<{ status: PreApplicationAppealStatus; createdAt: Date }>
  } | null,
) {
  const appeals = preApplication?.appeals ?? []

  return getPreApplicationAppealAvailability({
    appealEnabled,
    preApplicationStatus: preApplication?.status,
    hasPendingAppeal: appeals.some(
      (appeal) => appeal.status === PreApplicationAppealStatus.PENDING,
    ),
    lastAppealCreatedAt: appeals[0]?.createdAt ?? null,
  })
}

function createAppealAvailabilityErrorResponse(
  request: NextRequest,
  availability: ReturnType<typeof getAppealAvailability>,
) {
  switch (availability.reason) {
    case "APPEAL_DISABLED":
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.disabled, {
        status: 403,
      })
    case "PRE_APPLICATION_NOT_REJECTED":
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.preApplicationNotRejected,
        {
          status: 409,
        },
      )
    case "PENDING_APPEAL_EXISTS":
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.pendingAppealExists,
        {
          status: 409,
        },
      )
    case "APPEAL_COOLDOWN_ACTIVE":
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.cooldownActive, {
        status: 429,
        meta: {
          remainingSeconds: availability.cooldownRemainingSeconds,
        },
      })
    default:
      return createApiErrorResponse(request, ApiErrorKeys.general.failed, {
        status: 409,
      })
  }
}

function buildAutoRejectedMessage(input: {
  dict: Awaited<ReturnType<typeof getDictionary>>
  reviewComment: string
  submitBanUntil: Date | null
  locale: string
}) {
  const notifications = input.dict.preApplication.notifications as Record<string, any>
  const appealReview = notifications.appealReview ?? {}
  const footer = notifications.footer ?? ""

  return {
    title: notifications.appealAutoRejectedTitle ?? "Pre-application appeal auto-rejected",
    content: [
      notifications.appealAutoRejectedIntro ??
        "Your pre-application appeal was automatically rejected.",
      `${appealReview.reviewCommentLabel ?? "Review note: "}${input.reviewComment}`,
      input.submitBanUntil
        ? `${appealReview.submitBanUntilLabel ?? "Submit ban until: "}${input.submitBanUntil.toLocaleString(input.locale)}`
        : null,
      footer,
    ]
      .filter(Boolean)
      .join("\n\n"),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const [settings, preApplication] = await Promise.all([
      getPreApplicationAppealSettings(),
      db.preApplication.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: preApplicationWithAppealsSelect,
      }),
    ])

    const appeals = preApplication?.appeals ?? []
    const preApplicationRecord =
      preApplication === null
        ? null
        : {
            id: preApplication.id,
            status: preApplication.status,
            guidance: preApplication.guidance,
            queryToken: preApplication.queryToken,
            reviewedAt: preApplication.reviewedAt,
            createdAt: preApplication.createdAt,
            updatedAt: preApplication.updatedAt,
            reviewedBy: preApplication.reviewedBy,
          }

    return NextResponse.json({
      preApplication: preApplicationRecord,
      appeals,
      availability: getAppealAvailability(settings.appealEnabled, preApplication),
    })
  } catch (error) {
    console.error("Pre-application appeal fetch error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.failedToFetch, {
      status: 500,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const data = createPreApplicationAppealSchema.parse(body)
    const currentLocale = locales.includes(data.locale as Locale)
      ? (data.locale as Locale)
      : defaultLocale
    const dict = await getDictionary(currentLocale)

    const [settings, preApplication] = await Promise.all([
      getPreApplicationAppealSettings(),
      db.preApplication.findFirst({
        where: {
          id: data.preApplicationId,
          userId: user.id,
        },
        select: preApplicationWithAppealsSelect,
      }),
    ])

    if (!preApplication) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.noPreApplicationFound, {
        status: 404,
      })
    }

    const availability = getAppealAvailability(settings.appealEnabled, preApplication)
    if (!availability.canCreate) {
      return createAppealAvailabilityErrorResponse(request, availability)
    }

    const autoRejectedPattern = settings.autoRejectEnabled
      ? findMatchingAppealAutoRejectPattern({
          guidance: preApplication.guidance,
          patterns: settings.autoRejectPatterns,
        })
      : null

    const now = new Date()
    const appeal = await db.$transaction(async (tx) => {
      if (!autoRejectedPattern) {
        const created = await tx.preApplicationAppeal.create({
          data: {
            preApplicationId: preApplication.id,
            userId: user.id,
            source: PreApplicationAppealSource.USER_APPEAL,
            initiatedById: user.id,
            status: PreApplicationAppealStatus.PENDING,
            reason: data.reason,
          },
          select: appealSelect,
        })

        await writeAuditLog(tx, {
          action: "PRE_APPLICATION_APPEAL_CREATE",
          entityType: "PRE_APPLICATION_APPEAL",
          entityId: created.id,
          actor: user,
          after: created,
          metadata: {
            preApplicationId: preApplication.id,
            source: PreApplicationAppealSource.USER_APPEAL,
          },
          request,
        })

        return created
      }

      const userBefore = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          preApplicationSubmitBannedUntil: true,
        },
      })

      if (!userBefore) {
        throw new Error("Appeal user not found")
      }

      const submitBanUntil = settings.autoRejectApplySubmitBan
        ? getAppealRejectSubmitBanUntil(
            userBefore.preApplicationSubmitBannedUntil,
            settings.autoRejectSubmitBanDays,
            now,
          )
        : null

      if (submitBanUntil) {
        await tx.user.updateMany({
          where: {
            id: user.id,
            OR: [
              { preApplicationSubmitBannedUntil: null },
              { preApplicationSubmitBannedUntil: { lt: submitBanUntil } },
            ],
          },
          data: { preApplicationSubmitBannedUntil: submitBanUntil },
        })
      }

      const reviewComment =
        dict.preApplication.notifications.appealAutoRejectedReason ??
        "当前驳回意见命中自动拒绝规则，系统已自动驳回本次申诉。"

      const created = await tx.preApplicationAppeal.create({
        data: {
          preApplicationId: preApplication.id,
          userId: user.id,
          source: PreApplicationAppealSource.USER_APPEAL,
          initiatedById: user.id,
          status: PreApplicationAppealStatus.REJECTED,
          reason: data.reason,
          reviewedAt: now,
          reviewComment,
          submitBanApplied: settings.autoRejectApplySubmitBan,
          submitBanDays: settings.autoRejectApplySubmitBan
            ? settings.autoRejectSubmitBanDays
            : null,
          submitBanUntil,
          autoRejected: true,
          autoRejectedPattern,
        },
        select: appealSelect,
      })

      const messageContent = buildAutoRejectedMessage({
        dict,
        reviewComment,
        submitBanUntil,
        locale: currentLocale,
      })

      const message = await tx.message.create({
        data: {
          title: messageContent.title,
          content: messageContent.content,
          createdById: user.id,
          recipients: { create: { userId: user.id } },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_APPEAL_CREATE",
        entityType: "PRE_APPLICATION_APPEAL",
        entityId: created.id,
        actor: user,
        after: created,
        metadata: {
          preApplicationId: preApplication.id,
          source: PreApplicationAppealSource.USER_APPEAL,
          autoRejected: true,
          autoRejectedPattern,
          submitBanApplied: settings.autoRejectApplySubmitBan,
          submitBanDays: settings.autoRejectApplySubmitBan
            ? settings.autoRejectSubmitBanDays
            : null,
          submitBanUntil,
        },
        request,
      })

      if (submitBanUntil) {
        const userAfter = await tx.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            preApplicationSubmitBannedUntil: true,
          },
        })

        await writeAuditLog(tx, {
          action: "USER_ADMIN_UPDATE",
          entityType: "USER",
          entityId: user.id,
          actor: user,
          before: userBefore,
          after: userAfter,
          metadata: {
            source: "PRE_APPLICATION_APPEAL_AUTO_REJECT",
            appealId: created.id,
          },
          request,
        })
      }

      await writeAuditLog(tx, {
        action: "MESSAGE_CREATE",
        entityType: "MESSAGE",
        entityId: message.id,
        actor: user,
        after: message,
        metadata: { recipientUserId: user.id },
        request,
      })

      return created
    })

    return NextResponse.json({ appeal })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.pendingAppealExists,
        {
          status: 409,
        },
      )
    }

    console.error("Pre-application appeal create error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.failedToCreate, {
      status: 500,
    })
  }
}
