import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  buildPasskeyRegistrationOptions,
  isPasskeyConfigured,
  setPasskeyChallengeCookie,
} from "@/lib/auth/passkey"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
  }

  if (!db) {
    return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
  }

  if (!isPasskeyConfigured()) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.passkey.notConfigured, { status: 503 })
  }

  try {
    const credentials = await db.passkeyCredential.findMany({
      where: { userId: user.id },
      select: {
        credentialID: true,
        transports: true,
      },
    })

    const options = await buildPasskeyRegistrationOptions({
      user,
      credentials,
    })

    const response = NextResponse.json({ options })
    setPasskeyChallengeCookie(response, "register", options.challenge, user.id)
    return response
  } catch (error) {
    console.error("Passkey registration options API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.auth.passkey.registrationFailed, {
      status: 500,
    })
  }
}
