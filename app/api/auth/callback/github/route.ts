import { type NextRequest, NextResponse } from "next/server"
import { getGitHubProfile, handleOAuthSignIn } from "@/lib/auth/oauth"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { features } from "@/lib/features"
import { writeAuditLog } from "@/lib/audit"
import { db } from "@/lib/db"
import { buildRedirectUrl } from "@/lib/url"
import { consumeOAuthFingerprintContext } from "@/lib/fingerprint/oauth-context"
import { recordFingerprintEvent } from "@/lib/fingerprint/server"

export async function GET(request: NextRequest) {
  if (!features.oauth.github) {
    return NextResponse.redirect(buildRedirectUrl("/login?error=oauth_not_configured", request.url))
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const fingerprintContextToken = state?.startsWith("fp:") ? state.slice(3) : null

  if (!code) {
    return NextResponse.redirect(buildRedirectUrl("/login?error=no_code", request.url))
  }

  try {
    const profile = await getGitHubProfile(code)
    if (!profile) {
      return NextResponse.redirect(buildRedirectUrl("/login?error=oauth_failed", request.url))
    }

    const user = await handleOAuthSignIn("github", profile, request)
    const { token, expires } = await createSession(user.id)
    const sessionRecord = await db?.session.findUnique({
      where: { sessionToken: token },
    })
    const response = NextResponse.redirect(buildRedirectUrl("/dashboard", request.url))
    setSessionCookie(response, token, expires)
    if (db) {
      const fingerprintPayload =
        (fingerprintContextToken
          ? await consumeOAuthFingerprintContext(fingerprintContextToken)
          : null) ?? {
          fingerprintStatus: "COLLECTION_FAILED" as const,
          fingerprintFailureReason: fingerprintContextToken
            ? "oauth_context_not_found"
            : "oauth_context_missing",
        }

      await recordFingerprintEvent({
        db,
        eventType: "LOGIN_OAUTH",
        payload: fingerprintPayload,
        request,
        userId: user.id,
      })

      await writeAuditLog(db, {
        action: "AUTH_OAUTH_LOGIN",
        entityType: "AUTH",
        entityId: user.id,
        actor: user,
        metadata: { provider: "github" },
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
    }
    return response
  } catch {
    return NextResponse.redirect(buildRedirectUrl("/login?error=oauth_failed", request.url))
  }
}
