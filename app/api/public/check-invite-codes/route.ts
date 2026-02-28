import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

const checkSchema = z.object({
  codes: z.array(z.string()).min(1).max(5),
})

type CheckResult = {
  invite_code: string
  valid: boolean | null
  message: string
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const data = checkSchema.parse(body)

    // 获取系统配置中的检测 API 配置
    const settings = await db.siteSettings.findUnique({
      where: { id: "global" },
      select: {
        inviteCodeCheckApiUrl: true,
        inviteCodeCheckApiKey: true,
      },
    })

    if (!settings?.inviteCodeCheckApiUrl || !settings?.inviteCodeCheckApiKey) {
      return NextResponse.json({ success: false, error: "邀请码检测 API 未配置" }, { status: 400 })
    }

    // 调用外部检测 API
    const response = await fetch(settings.inviteCodeCheckApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": settings.inviteCodeCheckApiKey,
      },
      body: JSON.stringify({ invite_codes: data.codes }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `检测 API 响应异常: ${response.status}` },
        { status: 502 },
      )
    }

    const result = (await response.json()) as {
      success: boolean
      total: number
      results: CheckResult[]
    }

    return NextResponse.json({
      success: result.success,
      total: result.total,
      results: result.results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 })
    }
    console.error("Check invite codes error:", error)
    return NextResponse.json({ success: false, error: "检测失败" }, { status: 500 })
  }
}
