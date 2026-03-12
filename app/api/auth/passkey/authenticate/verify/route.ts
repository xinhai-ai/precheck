import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { generateResetToken } from "@/lib/auth/password"
import { getSiteSettings } from "@/lib/site-settings"
import { writeAuditLog } from "@/lib/audit"
import { sendEmail } from "@/lib/email/mailer"
import { getAccountReactivationEmail } from "@/lib/email/templates/account-reactivation"
import { createApiErrorResponse, resolveLocaleForRequest } from "@/lib/api/error-response"
import { parseFingerprintPayload } from "@/lib/fingerprint/payload"
import { recordFingerprintEvent } from "@/lib/fingerprint/server"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import {
  clearPasskeyChallengeCookie,
  getPasskeyChallenge,
  isPasskeyConfigured,
  verifyPasskeyAuthentication,
} from "@/lib/auth/passkey"

const authenticateVerifySchema = z.object({
  credential: z.any(),
})

async function createErrorResponse(
  request: NextRequest,
  key: string,
  status: number,
  meta?: Record<string, unknown>,
) {
  const response = await createApiErrorResponse(request, key, { status, meta })
  clearPasskeyChallengeCookie(response, "authenticate")
  return response
}

export async function POST(request: NextRequest) {
  if (!db) {
    return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
  }

  if (!isPasskeyConfigured()) {
    return createApiErrorResponse(request, ApiErrorKeys.auth.passkey.notConfigured, { status: 503 })
  }

  try {
    const body = await request.json()
    const { credential } = authenticateVerifySchema.parse(body)
    const fingerprintPayload = parseFingerprintPayload(body)
    const challenge = await getPasskeyChallenge("authenticate")

    if (!challenge) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.challengeExpired, 400)
    }

    const storedCredential = await db.passkeyCredential.findUnique({
      where: { credentialID: credential?.id ?? "" },
      include: { user: true },
    })

    if (!storedCredential) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.authenticationFailed, 401)
    }

    let verification
    try {
      verification = await verifyPasskeyAuthentication({
        credential,
        expectedChallenge: challenge.challenge,
        storedCredential,
      })
    } catch (error) {
      console.error("Passkey authentication verification error:", error)
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.authenticationFailed, 401)
    }

    if (!verification.verified) {
      return createErrorResponse(request, ApiErrorKeys.auth.passkey.authenticationFailed, 401)
    }

    const user = storedCredential.user
    const settings = await getSiteSettings()
    if (settings.maintenanceMode && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return createErrorResponse(request, "apiErrors.auth.login.maintenanceMode", 503)
    }

    if (user.status === "INACTIVE") {
      return createErrorResponse(request, "apiErrors.auth.login.invalidCredentials", 401)
    }

    if (user.status === "BANNED") {
      return createErrorResponse(
        request,
        "apiErrors.auth.login.banned",
        403,
        user.banReason ? { reason: user.banReason } : undefined,
      )
    }

    if (user.status === "DELETED") {
      const reactivationToken = generateResetToken()
      const reactivationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await db.user.update({
        where: { id: user.id },
        data: {
          reactivationToken,
          reactivationTokenExpiry,
        },
      })

      sendEmail(
        getAccountReactivationEmail(
          user.email,
          reactivationToken,
          process.env.NEXT_PUBLIC_APP_URL,
          undefined,
          resolveLocaleForRequest(request),
        ),
      ).catch((error) => {
        console.error("Failed to send reactivation email:", error)
      })

      return createErrorResponse(request, "apiErrors.auth.login.accountDeleted", 400)
    }

    await db.passkeyCredential.update({
      where: { id: storedCredential.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        deviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    })

    const { token, expires } = await createSession(user.id)
    const sessionRecord = await db.session.findUnique({
      where: { sessionToken: token },
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
    setSessionCookie(response, token, expires)
    clearPasskeyChallengeCookie(response, "authenticate")

    await recordFingerprintEvent({
      db,
      eventType: "LOGIN_PASSKEY",
      payload: fingerprintPayload,
      request,
      userId: user.id,
    })

    await writeAuditLog(db, {
      action: "AUTH_PASSKEY_LOGIN",
      entityType: "AUTH",
      entityId: user.id,
      actor: user,
      metadata: { credentialIdSuffix: storedCredential.credentialID.slice(-8) },
      request,
    })

    if (sessionRecord) {
      await writeAuditLog(db, {
        action: "SESSION_CREATE",
        entityType: "SESSION",
        entityId: sessionRecord.id,
        actor: user,
        after: sessionRecord,
        request,
      })
    }

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(request, ApiErrorKeys.general.invalid, 400)
    }

    console.error("Passkey authenticate verify API error:", error)
    return createErrorResponse(request, ApiErrorKeys.auth.passkey.authenticationFailed, 500)
  }
}
