import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { FingerprintLinkStatus } from "@prisma/client"
import { writeAuditLog } from "@/lib/audit"

// 审核请求 Schema
const reviewSchema = z.object({
  status: z.nativeEnum(FingerprintLinkStatus),
  note: z.string().max(1000).optional(),
  // 可选：批量封禁关联用户
  banUsers: z.boolean().default(false),
  banReason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 验证管理员权限
    const user = await getCurrentUserFromRequest(request)
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }
    const database = db

    const { id } = await params
    const body = await request.json()
    const data = reviewSchema.parse(body)

    // 获取当前记录
    const link = await database.fingerprintLink.findUnique({
      where: { id },
    })

    if (!link) {
      return NextResponse.json({ error: "Fingerprint link not found" }, { status: 404 })
    }

    const previousStatus = link.status

    // 更新状态
    const updated = await database.fingerprintLink.update({
      where: { id },
      data: {
        status: data.status,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote: data.note,
      },
    })

    // 记录审计日志
    await writeAuditLog(database, {
      entityType: "FingerprintLink",
      entityId: id,
      action: "FINGERPRINT_LINK_REVIEW",
      actor: user,
      before: { status: previousStatus },
      after: { status: data.status, note: data.note },
      metadata: {
        userIds: link.userIds,
        riskScore: link.riskScore,
      },
      request,
    })

    // 如果确认违规且需要封禁用户
    if (data.status === "CONFIRMED" && data.banUsers && link.userIds.length > 0) {
      // 保留第一个注册的用户，封禁其他用户
      const users = await database.user.findMany({
        where: { id: { in: link.userIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, createdAt: true },
      })

      if (users.length > 1) {
        const usersToBan = users.slice(1).map((u) => u.id)
        const banReason = data.banReason || "多账号违规"

        await database.user.updateMany({
          where: { id: { in: usersToBan } },
          data: {
            status: "BANNED",
            banReason,
          },
        })

        // 记录封禁审计日志
        for (const userId of usersToBan) {
          await writeAuditLog(database, {
            entityType: "User",
            entityId: userId,
            action: "USER_BAN",
            actor: user,
            before: { status: "ACTIVE" },
            after: { status: "BANNED" },
            metadata: {
              reason: banReason,
              fingerprintLinkId: id,
            },
            request,
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 },
      )
    }

    console.error("Admin fingerprint review API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
