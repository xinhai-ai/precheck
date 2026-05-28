import { type NextRequest, NextResponse } from "next/server"
import { getLinuxDoProfile, handleOAuthSignIn } from "@/lib/auth/oauth"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { features } from "@/lib/features"
import { writeAuditLog } from "@/lib/audit"
import { db } from "@/lib/db"
import { buildRedirectUrl } from "@/lib/url"
import { parseOAuthState } from "@/lib/auth/oauth-state"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const { locale } = parseOAuthState(state)

  if (!features.oauth.linuxdo) {
    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/login?error=oauth_not_configured`, request.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(buildRedirectUrl(`/${locale}/login?error=no_code`, request.url))
  }

  try {
    const profile = await getLinuxDoProfile(code)
    if (!profile) {
      return NextResponse.redirect(
        buildRedirectUrl(`/${locale}/login?error=oauth_failed`, request.url),
      )
    }

    // 登录模式
    const user = await handleOAuthSignIn("linuxdo", profile, request)
    const { token, expires } = await createSession(user.id)
    const sessionRecord = await db?.session.findUnique({
      where: { sessionToken: token },
    })
    const response = NextResponse.redirect(buildRedirectUrl(`/${locale}/dashboard`, request.url))
    setSessionCookie(response, token, expires)
    if (db) {
      await writeAuditLog(db, {
        action: "AUTH_OAUTH_LOGIN",
        entityType: "AUTH",
        entityId: user.id,
        actor: user,
        metadata: { provider: "linuxdo" },
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
    return NextResponse.redirect(
      buildRedirectUrl(`/${locale}/login?error=oauth_failed`, request.url),
    )
  }
}
