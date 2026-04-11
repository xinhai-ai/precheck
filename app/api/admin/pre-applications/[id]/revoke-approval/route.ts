import { type NextRequest, NextResponse } from "next/server"
import { PreApplicationStatus } from "@prisma/client"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { writeAuditLog } from "@/lib/audit"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"
import { shouldHidePreApplicationFromAdmin } from "@/lib/pre-application/admin-archived-visibility"
import { buildPreApplicationApprovalRevokedEmail } from "@/lib/email/templates"
import { sendEmail } from "@/lib/email/mailer"
import { features } from "@/lib/features"
import { getSiteSettings } from "@/lib/site-settings"

const revokeApprovalSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  locale: z.string().optional(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserFromRequest(request)

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
    const parsed = revokeApprovalSchema.safeParse(body)

    if (!parsed.success) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: parsed.error.errors[0]?.message },
      })
    }

    const currentLocale = locales.includes(parsed.data.locale as Locale)
      ? (parsed.data.locale as Locale)
      : defaultLocale
    const dict = await getDictionary(currentLocale)
    const reason = parsed.data.reason.trim()
    const reviewerName = user.name || user.email
    const now = new Date()

    const record = await db.preApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        essay: true,
        source: true,
        sourceDetail: true,
        registerEmail: true,
        group: true,
        status: true,
        guidance: true,
        reviewedAt: true,
        version: true,
        inviteCodeId: true,
        codeSent: true,
        codeSentAt: true,
        holdUntil: true,
        formalApplicationApprovedFeedbackAt: true,
        user: { select: { id: true, name: true, email: true } },
        inviteCode: {
          select: {
            id: true,
            code: true,
            expiresAt: true,
            usedAt: true,
            assignedAt: true,
            assignedById: true,
          },
        },
      },
    })

    if (!record || shouldHidePreApplicationFromAdmin(record.status, user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    if (record.status !== PreApplicationStatus.APPROVED) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.approvalNotRevocable,
        {
          status: 409,
        },
      )
    }

    if (record.inviteCode?.usedAt) {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.admin.preApplications.approvalRevokeInviteAlreadyUsed,
        { status: 409 },
      )
    }

    const newVersion = record.version + 1

    await db.$transaction(async (tx) => {
      let inviteBefore: {
        id: string
        assignedAt: Date | null
        assignedById: string | null
      } | null = null
      let inviteAfter: {
        id: string
        assignedAt: Date | null
        assignedById: string | null
      } | null = null

      if (record.inviteCodeId) {
        inviteBefore = await tx.inviteCode.findUnique({
          where: { id: record.inviteCodeId },
          select: { id: true, assignedAt: true, assignedById: true },
        })
        inviteAfter = await tx.inviteCode.update({
          where: { id: record.inviteCodeId },
          data: {
            assignedAt: null,
            assignedById: null,
          },
          select: { id: true, assignedAt: true, assignedById: true },
        })
      }

      await tx.preApplicationVersion.create({
        data: {
          preApplicationId: record.id,
          version: newVersion,
          essay: record.essay,
          source: record.source,
          sourceDetail: record.sourceDetail,
          registerEmail: record.registerEmail,
          group: record.group,
          status: PreApplicationStatus.PENDING,
          guidance: reason,
          reviewedAt: now,
          reviewedById: user.id,
        },
      })

      const updated = await tx.preApplication.update({
        where: { id: record.id },
        data: {
          status: PreApplicationStatus.PENDING,
          guidance: reason,
          version: newVersion,
          reviewedAt: now,
          reviewedBy: { connect: { id: user.id } },
          codeSent: false,
          codeSentAt: null,
          holdUntil: null,
          inviteCode: { disconnect: true },
        },
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_REVIEW_REVOKE_APPROVAL",
        entityType: "PRE_APPLICATION",
        entityId: record.id,
        actor: user,
        before: record,
        after: updated,
        metadata: {
          reason,
          restoredStatus: PreApplicationStatus.PENDING,
        },
        request,
      })

      if (inviteAfter) {
        await writeAuditLog(tx, {
          action: "INVITE_CODE_UNASSIGN",
          entityType: "INVITE_CODE",
          entityId: inviteAfter.id,
          actor: user,
          before: inviteBefore,
          after: inviteAfter,
          metadata: {
            preApplicationId: record.id,
            reason: "approval-revoked",
          },
          request,
        })
      }
    })

    const settings = await getSiteSettings()
    const shouldSendEmail = features.email && settings.emailNotifications

    let emailSent = false
    let emailError: string | undefined

    if (shouldSendEmail) {
      const emailContent = buildPreApplicationApprovalRevokedEmail({
        appName: settings.siteName || dict.metadata?.title || "App",
        dictionary: dict,
        reviewerName,
        reason,
        locale: currentLocale,
      })

      try {
        await sendEmail({
          to: record.registerEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        })
        emailSent = true
      } catch (sendError) {
        console.error("Pre-application approval revoke email failed:", sendError)
        emailError = sendError instanceof Error ? sendError.message : String(sendError)
      }
    }

    return NextResponse.json({ success: true, emailSent, emailError })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message },
      })
    }

    console.error("Pre-application approval revoke error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplications.approvalRevokeFailed,
      {
        status: 500,
      },
    )
  }
}
