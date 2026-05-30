import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { FingerprintLinkStatus, type Prisma } from "@prisma/client"

// 查询参数 Schema
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: z.nativeEnum(FingerprintLinkStatus).optional(),
  minRiskScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["riskScore", "createdAt", "updatedAt"]).default("riskScore"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export async function GET(request: NextRequest) {
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

    // 解析查询参数
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const query = querySchema.parse(searchParams)

    // 构建查询条件
    const where: Prisma.FingerprintLinkWhereInput = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.minRiskScore !== undefined) {
      where.riskScore = { gte: query.minRiskScore }
    }

    if (query.search) {
      where.OR = [{ visitorId: { contains: query.search, mode: "insensitive" } }]
    }

    // 查询总数
    const total = await database.fingerprintLink.count({ where })

    // 查询列表
    const links = await database.fingerprintLink.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // 获取关联用户的基本信息
    const allUserIds = links.flatMap((link) => link.userIds)
    const uniqueUserIds = [...new Set(allUserIds)]

    const users = await database.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    // 组装返回数据
    const data = links.map((link) => ({
      ...link,
      users: link.userIds
        .map((id) => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => u !== undefined),
    }))

    // 统计信息
    const stats = await database.fingerprintLink.groupBy({
      by: ["status"],
      _count: { id: true },
    })

    const statusCounts: Record<FingerprintLinkStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      CLEARED: 0,
      IGNORED: 0,
    }

    for (const stat of stats) {
      statusCounts[stat.status] = stat._count.id
    }

    return NextResponse.json({
      data,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      stats: statusCounts,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.issues },
        { status: 400 },
      )
    }

    console.error("Admin fingerprints API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
