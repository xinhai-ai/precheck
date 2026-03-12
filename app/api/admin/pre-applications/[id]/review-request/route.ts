import { type NextRequest, NextResponse } from "next/server"
import {
  Prisma,
  PreApplicationAppealSource,
  PreApplicationAppealStatus,
  PreApplicationStatus,
} from "@prisma/client"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { db } from "@/lib/db"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"
import { shouldHidePreApplicationFromAdmin } from "@/lib/pre-application/admin-archived-visibility"

const reviewRequestSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  locale: z.string().optional(),
})

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const

function buildReviewRequestCreatedMessage(input: {
  dict: Awaited<ReturnType<typeof getDictionary>>
  reason: string
}) {
  const notifications = input.dict.preApplication.notifications as Record<string, any>
  const footer = notifications.footer ?? ""
  const reasonLabel = notifications.reviewCommentLabel ?? "Reason: "
  const title = notifications.reviewRequestCreatedTitle ?? "Pre-application review request created"
  const intro =
    notifications.reviewRequestCreatedIntro ??
    "An administrator has submitted a review request for your rejected pre-application."

  return {
    title,
    content: [intro, `${reasonLabel}${input.reason}`, footer].filter(Boolean).join("\n\n"),
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const body = await request.json()
    const parsed = reviewRequestSchema.safeParse(body)

    if (!parsed.success) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: parsed.error.errors[0]?.message },
      })
    }

    const localeParam = parsed.data.locale
    const currentLocale = locales.includes(localeParam as Locale)
      ? (localeParam as Locale)
      : defaultLocale
    const dict = await getDictionary(currentLocale)

    const preApplication = await db.preApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        registerEmail: true,
        queryToken: true,
        guidance: true,
        user: { select: userSelect },
        appeals: {
          where: { status: PreApplicationAppealStatus.PENDING },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    })

    if (!preApplication || shouldHidePreApplicationFromAdmin(preApplication.status, user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    if (preApplication.status !== PreApplicationStatus.REJECTED) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.preApplicationNotRejected,
        { status: 409 },
      )
    }

    if (!preApplication.userId) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 409,
        meta: { detail: "该预申请未绑定用户，无法提交复审请求" },
      })
    }

    if (preApplication.appeals.length > 0) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.pendingAppealExists, {
        status: 409,
      })
    }

    const messageContent = buildReviewRequestCreatedMessage({
      dict,
      reason: parsed.data.reason,
    })

    const result = await db.$transaction(async (tx) => {
      const appeal = await tx.preApplicationAppeal.create({
        data: {
          preApplicationId: preApplication.id,
          userId: preApplication.userId!,
          source: PreApplicationAppealSource.ADMIN_REVIEW_REQUEST,
          initiatedById: user.id,
          status: PreApplicationAppealStatus.PENDING,
          reason: parsed.data.reason,
        },
        select: {
          id: true,
          preApplicationId: true,
          userId: true,
          source: true,
          initiatedById: true,
          status: true,
          reason: true,
          reviewedAt: true,
          reviewComment: true,
          createdAt: true,
          updatedAt: true,
          user: { select: userSelect },
          initiatedBy: { select: userSelect },
        },
      })

      const message = await tx.message.create({
        data: {
          title: messageContent.title,
          content: messageContent.content,
          createdById: user.id,
          recipients: { create: { userId: preApplication.userId! } },
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
        entityId: appeal.id,
        actor: user,
        after: appeal,
        metadata: {
          preApplicationId: preApplication.id,
          source: PreApplicationAppealSource.ADMIN_REVIEW_REQUEST,
          initiatedById: user.id,
        },
        request,
      })

      await writeAuditLog(tx, {
        action: "MESSAGE_CREATE",
        entityType: "MESSAGE",
        entityId: message.id,
        actor: user,
        after: message,
        metadata: { recipientUserId: preApplication.userId },
        request,
      })

      return { appeal, message }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.pendingAppealExists, {
        status: 409,
      })
    }

    console.error("Admin pre-application review request create error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.failedToCreate, {
      status: 500,
    })
  }
}
