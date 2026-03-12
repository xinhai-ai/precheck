import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  buildPasskeyAuthenticationOptions,
  isPasskeyConfigured,
  setPasskeyChallengeCookie,
} from "@/lib/auth/passkey"

export async function POST(request: NextRequest) {
  if (!db) {
    return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
  }

  if (!isPasskeyConfigured()) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.passkey.notConfigured, { status: 503 })
  }

  try {
    const options = await buildPasskeyAuthenticationOptions()
    const response = NextResponse.json({ options })
    setPasskeyChallengeCookie(response, "authenticate", options.challenge)
    return response
  } catch (error) {
    console.error("Passkey authentication options API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.auth.passkey.authenticationFailed, {
      status: 500,
    })
  }
}
