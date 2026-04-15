import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { sendEmail } from "@/lib/email/mailer"
import { writeAuditLog } from "@/lib/audit"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { manualOutboundSchema } from "@/lib/manual-outbound"
import { sendManualOutbound } from "@/lib/manual-outbound-service"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user || !isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }
    const database = db

    const body = await request.json()
    const payload = manualOutboundSchema.parse(body)

    const result = await sendManualOutbound(
      {
        getUserById: async (userId) =>
          database.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true },
          }),
        createMessage: async ({ title, content, recipientUserId, actorId }) =>
          database.message.create({
            data: {
              title,
              content,
              createdById: actorId,
              recipients: {
                create: {
                  userId: recipientUserId,
                },
              },
            },
            select: { id: true },
          }),
        sendEmail: ({ to, subject, text, html }) => sendEmail({ to, subject, text, html }),
        writeAuditLog: (input) =>
          writeAuditLog(database, {
            ...(input as Parameters<typeof writeAuditLog>[1]),
            request,
          }),
      },
      {
        actor: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        payload,
      },
    )

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0]?.message ?? "Invalid request" },
      })
    }

    console.error("Manual outbound API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.manualOutbound.failed, {
      status: 500,
    })
  }
}
