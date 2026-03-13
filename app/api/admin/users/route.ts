import { type NextRequest, NextResponse } from "next/server"
import { type Prisma, Role, UserStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUserFromRequest } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    // 用户管理仅限超级管理员
    if (!isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { searchParams } = request.nextUrl
    const search = searchParams.get("search") || ""
    const sortByParam = searchParams.get("sortBy") || "createdAt"
    const sortOrderParam = searchParams.get("sortOrder")
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit
    const allowedSortBy = new Set(["createdAt", "email", "name", "role", "status"])
    const sortBy = allowedSortBy.has(sortByParam) ? sortByParam : "createdAt"
    const sortOrder = sortOrderParam === "asc" ? "asc" : "desc"

    // 筛选参数
    const roleFilter = searchParams.get("role")
    const statusFilter = searchParams.get("status")
    const providerFilter = searchParams.get("provider")
    const linuxdoTL3 = searchParams.get("linuxdoTL3") === "true"
    const fingerprintHash = (searchParams.get("fingerprintHash") || "").trim()

    // 构建查询条件
    const conditions: Prisma.UserWhereInput[] = []

    if (search) {
      conditions.push({
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      })
    }

    if (roleFilter && roleFilter !== "all" && Object.values(Role).includes(roleFilter as Role)) {
      conditions.push({ role: roleFilter as Role })
    }

    if (
      statusFilter &&
      statusFilter !== "all" &&
      Object.values(UserStatus).includes(statusFilter as UserStatus)
    ) {
      conditions.push({ status: statusFilter as UserStatus })
    }

    if (providerFilter && providerFilter !== "all") {
      conditions.push({ accounts: { some: { provider: providerFilter } } })
    }

    if (linuxdoTL3) {
      conditions.push({
        accounts: { some: { provider: "linuxdo", trustLevel: { gte: 3 } } },
      })
    }

    if (fingerprintHash) {
      conditions.push({
        latestFingerprintHash: { contains: fingerprintHash, mode: "insensitive" },
      })
    }

    const where = conditions.length > 0 ? { AND: conditions } : {}

    const [usersRaw, total, stats] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          banReason: true,
          preApplicationSubmitBannedUntil: true,
          preApplicationReapplyEligibleAt: true,
          preApplicationReapplyStartedAt: true,
          createdAt: true,
          latestFingerprintHash: true,
          latestFingerprintAt: true,
          preApplications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
            },
          },
          _count: {
            select: {
              preApplications: true,
              preApplicationsReviewed: true,
            },
          },
          shadowBannedEntry: {
            select: {
              reason: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      db.user.count({ where }),
      // 统计数据
      Promise.all([
        db.user.count(),
        db.user.count({ where: { role: "ADMIN" } }),
        db.user.count({ where: { status: "ACTIVE" } }),
        db.user.count({ where: { status: "BANNED" } }),
        db.user.count({ where: { accounts: { some: { provider: "linuxdo" } } } }),
        db.user.count({
          where: {
            accounts: { some: { provider: "linuxdo", trustLevel: { gte: 3 } } },
            role: "ADMIN",
          },
        }),
      ]).then(([totalUsers, admins, active, banned, linuxdo, linuxdoTL3Admins]) => ({
        total: totalUsers,
        admins,
        active,
        banned,
        linuxdo,
        linuxdoTL3Admins,
      })),
    ])

    const users = usersRaw.map(({ _count, shadowBannedEntry, preApplications, ...rest }) => ({
      ...rest,
      latestPreApplicationStatus: preApplications[0]?.status ?? null,
      latestPreApplicationId: preApplications[0]?.id ?? null,
      applicationCount: _count.preApplications,
      reviewCount: _count.preApplicationsReviewed,
      shadowBanned: Boolean(shadowBannedEntry),
      shadowBanReason: shadowBannedEntry?.reason ?? null,
      shadowBannedAt: shadowBannedEntry?.createdAt ?? null,
    }))

    return NextResponse.json({ users, total, page, limit, stats })
  } catch (error) {
    console.error("Users API error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.users.failedToFetch, {
      status: 500,
    })
  }
}
