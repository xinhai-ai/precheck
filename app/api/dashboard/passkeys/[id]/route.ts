import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params
    const passkey = await db.passkeyCredential.findUnique({
      where: { id },
    })

    if (!passkey || passkey.userId !== user.id) {
      return createApiErrorResponse(request, ApiErrorKeys.dashboard.passkeys.notFound, {
        status: 404,
      })
    }

    await db.passkeyCredential.delete({ where: { id } })

    await writeAuditLog(db, {
      action: "AUTH_PASSKEY_DELETE",
      entityType: "PASSKEY",
      entityId: passkey.id,
      actor: user,
      before: {
        id: passkey.id,
        credentialIdSuffix: passkey.credentialID.slice(-8),
        deviceType: passkey.deviceType,
      },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete dashboard passkey API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.dashboard.passkeys.failedToDelete, {
      status: 500,
    })
  }
}
