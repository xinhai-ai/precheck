import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { serializePasskeyCredential } from "@/lib/auth/passkey"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const passkeys = await db.passkeyCredential.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        credentialID: true,
        deviceType: true,
        backedUp: true,
        transports: true,
        createdAt: true,
        lastUsedAt: true,
      },
    })

    return NextResponse.json({
      passkeys: passkeys.map(serializePasskeyCredential),
    })
  } catch (error) {
    console.error("Dashboard passkeys API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.dashboard.passkeys.failedToFetch, {
      status: 500,
    })
  }
}
