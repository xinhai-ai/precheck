import { NextRequest, NextResponse } from "next/server"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    })
  } catch {
    return createApiErrorResponse(request, ApiErrorKeys.auth.me.failedToGetUser, { status: 500 })
  }
}
