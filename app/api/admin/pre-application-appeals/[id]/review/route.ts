import { type NextRequest, NextResponse } from "next/server"
import { Prisma, PreApplicationAppealStatus, PreApplicationStatus } from "@prisma/client"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { db } from "@/lib/db"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"
import { getAppealRejectSubmitBanUntil } from "@/lib/pre-application/appeal-utils"

const reviewSchema = z.object({
  action: z.string().trim(),
  reviewComment: z.string().trim().min(1).max(2000),
  locale: z.string().optional(),
})

const REVIEW_ACTIONS = new Set(["REJECT", "OVERRIDE"] as const)

type ReviewAction = "REJECT" | "OVERRIDE"

class AppealReviewConflictError extends Error {
  constructor(public readonly errorKey: string) {
    super(errorKey)
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const

function buildAppealReviewMessage(input: {
  dict: Awaited<ReturnType<typeof getDictionary>>
  action: ReviewAction
  reviewComment: string
  bannedUntil?: Date
  locale: string
}) {
  const t = input.dict.preApplication.notifications.appealReview
  const footer = input.dict.preApplication.notifications.footer

  if (input.action === "REJECT") {
    return {
      title: t.rejectedTitle,
      content: [
        t.rejectedIntro,
        `${t.reviewCommentLabel}${input.reviewComment}`,
        `${t.submitBanUntilLabel}${input.bannedUntil?.toLocaleString(input.locale)}`,
        footer,
      ].join("\n\n"),
    }
  }

  return {
    title: t.overriddenTitle,
    content: [
      t.overriddenIntro,
      `${t.reviewCommentLabel}${input.reviewComment}`,
      t.overriddenNextStep,
      footer,
    ].join("\n\n"),
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const body = await request.json()
    const parsed = reviewSchema.safeParse(body)

    if (!parsed.success) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: parsed.error.errors[0]?.message },
      })
    }

    if (!REVIEW_ACTIONS.has(parsed.data.action as ReviewAction)) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplicationAppeals.invalidAction,
        {
          status: 400,
        },
      )
    }

    const action = parsed.data.action as ReviewAction
    const reviewComment = parsed.data.reviewComment.trim()
    const localeParam = parsed.data.locale
    const currentLocale = locales.includes(localeParam as Locale)
      ? (localeParam as Locale)
      : defaultLocale
    const dict = await getDictionary(currentLocale)

    const appeal = await db.preApplicationAppeal.findUnique({
      where: { id },
      select: {
        id: true,
        preApplicationId: true,
        userId: true,
        status: true,
        reason: true,
        reviewComment: true,
        reviewedById: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            ...userSelect,
            preApplicationSubmitBannedUntil: true,
          },
        },
        reviewedBy: { select: userSelect },
        preApplication: {
          select: {
            id: true,
            status: true,
            guidance: true,
            reviewedAt: true,
            reviewedById: true,
            version: true,
            essay: true,
            source: true,
            sourceDetail: true,
            registerEmail: true,
            group: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!appeal) {
      return createApiErrorResponse(request, ApiErrorKeys.admin.preApplicationAppeals.notFound, {
        status: 404,
      })
    }

    const now = new Date()

    const result = await db.$transaction(async (tx) => {
      const reviewResult = await tx.preApplicationAppeal.updateMany({
        where: {
          id: appeal.id,
          status: PreApplicationAppealStatus.PENDING,
        },
        data: {
          status:
            action === "REJECT"
              ? PreApplicationAppealStatus.REJECTED
              : PreApplicationAppealStatus.OVERRIDDEN,
          reviewComment,
          reviewedAt: now,
          reviewedById: user.id,
        },
      })

      if (reviewResult.count !== 1) {
        throw new AppealReviewConflictError(
          ApiErrorKeys.admin.preApplicationAppeals.alreadyReviewed,
        )
      }

      const updatedAppeal = await tx.preApplicationAppeal.findUnique({
        where: { id: appeal.id },
        select: {
          id: true,
          preApplicationId: true,
          userId: true,
          status: true,
          reason: true,
          reviewComment: true,
          reviewedById: true,
          reviewedAt: true,
          createdAt: true,
          updatedAt: true,
          reviewedBy: { select: userSelect },
        },
      })

      if (!updatedAppeal) {
        throw new Error("Updated appeal not found")
      }

      if (action === "REJECT") {
        const lockedPreApplications = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "PreApplication"
          WHERE "id" = ${appeal.preApplicationId}
            AND "status" = ${PreApplicationStatus.REJECTED}
            AND "version" = ${appeal.preApplication.version}
          FOR UPDATE
        `)

        if (lockedPreApplications.length !== 1) {
          throw new AppealReviewConflictError(
            ApiErrorKeys.admin.preApplicationAppeals.targetChanged,
          )
        }

        const userBefore = await tx.user.findUnique({
          where: { id: appeal.userId },
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

        const submitBannedUntil = getAppealRejectSubmitBanUntil(
          userBefore.preApplicationSubmitBannedUntil,
          now,
        )

        await tx.user.updateMany({
          where: {
            id: appeal.userId,
            OR: [
              { preApplicationSubmitBannedUntil: null },
              { preApplicationSubmitBannedUntil: { lt: submitBannedUntil } },
            ],
          },
          data: { preApplicationSubmitBannedUntil: submitBannedUntil },
        })

        const updatedUser = await tx.user.findUnique({
          where: { id: appeal.userId },
          select: {
            id: true,
            name: true,
            email: true,
            preApplicationSubmitBannedUntil: true,
          },
        })

        if (!updatedUser?.preApplicationSubmitBannedUntil) {
          throw new Error("Updated appeal user not found")
        }

        const messageContent = buildAppealReviewMessage({
          dict,
          action,
          reviewComment,
          bannedUntil: updatedUser.preApplicationSubmitBannedUntil,
          locale: currentLocale,
        })

        const message = await tx.message.create({
          data: {
            title: messageContent.title,
            content: messageContent.content,
            createdById: user.id,
            recipients: { create: { userId: appeal.userId } },
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        })

        await writeAuditLog(tx, {
          action: "PRE_APPLICATION_APPEAL_REVIEW_REJECT",
          entityType: "PRE_APPLICATION_APPEAL",
          entityId: appeal.id,
          actor: user,
          before: appeal,
          after: updatedAppeal,
          metadata: {
            preApplicationId: appeal.preApplicationId,
            reviewComment,
            submitBannedUntil,
          },
          request,
        })

        await writeAuditLog(tx, {
          action: "USER_ADMIN_UPDATE",
          entityType: "USER",
          entityId: appeal.userId,
          actor: user,
          before: userBefore,
          after: updatedUser,
          metadata: {
            source: "PRE_APPLICATION_APPEAL_REVIEW_REJECT",
            appealId: appeal.id,
          },
          request,
        })

        await writeAuditLog(tx, {
          action: "MESSAGE_CREATE",
          entityType: "MESSAGE",
          entityId: message.id,
          actor: user,
          after: message,
          metadata: { recipientUserId: appeal.userId },
          request,
        })

        return {
          appeal: updatedAppeal,
          message,
          submitBannedUntil,
        }
      }

      const nextVersion = appeal.preApplication.version + 1
      const preApplicationUpdateResult = await tx.preApplication.updateMany({
        where: {
          id: appeal.preApplicationId,
          status: PreApplicationStatus.REJECTED,
          version: appeal.preApplication.version,
        },
        data: {
          status: PreApplicationStatus.PENDING,
          guidance: null,
          reviewedAt: null,
          reviewedById: null,
          version: nextVersion,
        },
      })

      if (preApplicationUpdateResult.count !== 1) {
        throw new AppealReviewConflictError(ApiErrorKeys.admin.preApplicationAppeals.targetChanged)
      }

      await tx.preApplicationVersion.create({
        data: {
          preApplicationId: appeal.preApplication.id,
          version: nextVersion,
          essay: appeal.preApplication.essay,
          source: appeal.preApplication.source,
          sourceDetail: appeal.preApplication.sourceDetail,
          registerEmail: appeal.preApplication.registerEmail,
          group: appeal.preApplication.group,
          status: PreApplicationStatus.PENDING,
          guidance: null,
          reviewedAt: null,
          reviewedById: null,
        },
      })

      const updatedPreApplication = await tx.preApplication.findUnique({
        where: { id: appeal.preApplicationId },
        select: {
          id: true,
          status: true,
          guidance: true,
          reviewedAt: true,
          reviewedById: true,
          version: true,
          updatedAt: true,
        },
      })

      if (!updatedPreApplication) {
        throw new Error("Updated pre-application not found")
      }

      const messageContent = buildAppealReviewMessage({
        dict,
        action,
        reviewComment,
        locale: currentLocale,
      })

      const message = await tx.message.create({
        data: {
          title: messageContent.title,
          content: messageContent.content,
          createdById: user.id,
          recipients: { create: { userId: appeal.userId } },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_APPEAL_REVIEW_OVERRIDE",
        entityType: "PRE_APPLICATION_APPEAL",
        entityId: appeal.id,
        actor: user,
        before: appeal,
        after: updatedAppeal,
        metadata: {
          preApplicationId: appeal.preApplicationId,
          reviewComment,
        },
        request,
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_REOPEN_FROM_APPEAL",
        entityType: "PRE_APPLICATION",
        entityId: appeal.preApplicationId,
        actor: user,
        before: appeal.preApplication,
        after: updatedPreApplication,
        metadata: {
          appealId: appeal.id,
          reviewComment,
        },
        request,
      })

      await writeAuditLog(tx, {
        action: "MESSAGE_CREATE",
        entityType: "MESSAGE",
        entityId: message.id,
        actor: user,
        after: message,
        metadata: { recipientUserId: appeal.userId },
        request,
      })

      return {
        appeal: updatedAppeal,
        preApplication: updatedPreApplication,
        message,
      }
    })

    return NextResponse.json({
      success: true,
      appeal: result.appeal,
      ...(action === "REJECT"
        ? { submitBannedUntil: result.submitBannedUntil }
        : { preApplication: result.preApplication }),
    })
  } catch (error) {
    if (error instanceof AppealReviewConflictError) {
      return createApiErrorResponse(request, error.errorKey, { status: 409 })
    }

    console.error("Admin pre-application appeal review error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplicationAppeals.failedToReview,
      {
        status: 500,
      },
    )
  }
}
