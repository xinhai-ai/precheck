import { type NextRequest, NextResponse } from "next/server"
import { parseFingerprintPayload } from "@/lib/fingerprint/payload"
import { createOAuthFingerprintContext } from "@/lib/fingerprint/oauth-context"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const payload = parseFingerprintPayload(body)
    const token = await createOAuthFingerprintContext(payload)

    return NextResponse.json({ token })
  } catch (error) {
    console.error("[fingerprint] oauth context create failed:", error)
    return createApiErrorResponse(request, ApiErrorKeys.general.failed, { status: 500 })
  }
}

