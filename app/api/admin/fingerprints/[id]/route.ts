import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { getFingerprintLinkDetails } from "@/lib/fingerprint/link-check"

export async function GET(
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

    // 获取详细信息
    const details = await getFingerprintLinkDetails(id)

    if (!details) {
      return NextResponse.json({ error: "Fingerprint link not found" }, { status: 404 })
    }

    // 获取关联用户的预申请记录
    const preApplications = await database.preApplication.findMany({
      where: {
        OR: [
          { userId: { in: details.userIds } },
          { fingerprintId: { in: details.fingerprints.map((f) => f.id) } },
        ],
      },
      select: {
        id: true,
        userId: true,
        registerEmail: true,
        status: true,
        createdAt: true,
        fingerprintId: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      ...details,
      preApplications,
    })
  } catch (error) {
    console.error("Admin fingerprint detail API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
