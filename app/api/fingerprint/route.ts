import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { checkAndCreateFingerprintLink } from "@/lib/fingerprint/link-check"

// 指纹上报请求 Schema
const fingerprintSchema = z.object({
  visitorId: z.string().min(1).max(100),
  confidence: z.number().min(0).max(1).optional(),
  components: z
    .object({
      userAgent: z.string().optional(),
      browser: z.string().optional(),
      os: z.string().optional(),
      device: z.string().optional(),
      language: z.string().optional(),
      languages: z.array(z.string()).optional(),
      platform: z.string().optional(),
      screenResolution: z.string().optional(),
      timezone: z.string().optional(),
      timezoneOffset: z.number().optional(),
      webglVendor: z.string().optional(),
      webglRenderer: z.string().optional(),
      canvasHash: z.string().optional(),
      audioHash: z.string().optional(),
      fonts: z.array(z.string()).optional(),
    })
    .optional(),
  raw: z.any().optional(),
})

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    const database = db

    const body = await request.json()
    const data = fingerprintSchema.parse(body)

    // 获取当前用户（可选 - 访客也可上报，但只有登录用户才建立关联）
    const user = await getCurrentUserFromRequest(request)
    const userId = user?.id

    // 获取 IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"

    // 提取组件字段（统一处理 create / update）
    const componentFields = data.components
      ? {
          userAgent: data.components.userAgent,
          browser: data.components.browser,
          os: data.components.os,
          device: data.components.device,
          language: data.components.language,
          languages: data.components.languages
            ? JSON.stringify(data.components.languages)
            : undefined,
          platform: data.components.platform,
          screenResolution: data.components.screenResolution,
          timezone: data.components.timezone,
          timezoneOffset: data.components.timezoneOffset,
          webglVendor: data.components.webglVendor,
          webglRenderer: data.components.webglRenderer,
          canvasHash: data.components.canvasHash,
          audioHash: data.components.audioHash,
          fonts: data.components.fonts
            ? JSON.stringify(data.components.fonts)
            : undefined,
        }
      : {}

    const rawComponents = data.raw?.components ?? undefined

    // 查找该 visitorId + userId 的现有记录
    const existingFingerprint = await database.deviceFingerprint.findFirst({
      where: {
        visitorId: data.visitorId,
        ...(userId ? { userId } : { userId: null }),
      },
      orderBy: { lastSeenAt: "desc" },
    })

    let fingerprint
    if (existingFingerprint) {
      fingerprint = await database.deviceFingerprint.update({
        where: { id: existingFingerprint.id },
        data: {
          lastSeenAt: new Date(),
          ip,
          confidence: data.confidence,
          ...componentFields,
          components: rawComponents,
        },
      })
    } else {
      fingerprint = await database.deviceFingerprint.create({
        data: {
          visitorId: data.visitorId,
          userId,
          ip,
          confidence: data.confidence,
          ...componentFields,
          components: rawComponents,
        },
      })
    }

    // 检查并创建指纹关联（仅登录用户）
    let linkInfo = null
    if (userId) {
      linkInfo = await checkAndCreateFingerprintLink(data.visitorId, userId)
    }

    return NextResponse.json({
      success: true,
      fingerprintId: fingerprint.id,
      linkInfo,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      )
    }

    console.error("Fingerprint API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
