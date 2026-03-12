import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  clearPasskeyChallengeCookie,
  getPasskeyChallenge,
  isPasskeyConfigured,
  serializePasskeyCredential,
  verifyPasskeyRegistration,
} from "@/lib/auth/passkey"

const registerVerifySchema = z.object({
  credential: z.any(),
})

async function createErrorResponse(request: NextRequest, key: string, status: number) {
  const response = await createApiErrorResponse(request, key, { status })
  clearPasskeyChallengeCookie(response, "register")
  return response
}

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
    const body = await request.json()
    const { credential } = registerVerifySchema.parse(body)
    const challenge = await getPasskeyChallenge("register")

    if (!challenge || challenge.userId !== user.id) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.challengeExpired, 400)
    }

    const existingCredential = await db.passkeyCredential.findUnique({
      where: { credentialID: credential?.id ?? "" },
    })
    if (existingCredential) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.alreadyExists, 409)
    }

    let verification
    try {
      verification = await verifyPasskeyRegistration({
        credential,
        expectedChallenge: challenge.challenge,
      })
    } catch (error) {
      console.error("Passkey registration verification error:", error)
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.verificationFailed, 400)
    }

    if (!verification.verified || !verification.registrationInfo) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.verificationFailed, 400)
    }

    const info = verification.registrationInfo
    const created = await db.passkeyCredential.create({
      data: {
        userId: user.id,
        credentialID: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: BigInt(info.credential.counter),
        transports: info.credential.transports ?? credential?.response?.transports ?? [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
      },
    })

    await writeAuditLog(db, {
      action: "AUTH_PASSKEY_REGISTER",
      entityType: "PASSKEY",
      entityId: created.id,
      actor: user,
      after: {
        id: created.id,
        credentialIdSuffix: created.credentialID.slice(-8),
        deviceType: created.deviceType,
      },
      request,
    })

    const response = NextResponse.json(
      { success: true, passkey: serializePasskeyCredential(created) },
      { status: 201 },
    )
    clearPasskeyChallengeCookie(response, "register")
    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(request, ApiErrorKeys.general.invalid, 400)
    }

    console.error("Passkey register verify API error:", error)
    return createErrorResponse(request, ApiErrorKeys.auth.passkey.registrationFailed, 500)
  }
}
