import { type NextRequest, NextResponse } from "next/server"
import { type Prisma, Role, UserStatus } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n")
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!isSuperAdmin(user.role)) {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { searchParams } = request.nextUrl
    const search = searchParams.get("search") || ""
    const roleFilter = searchParams.get("role")
    const statusFilter = searchParams.get("status")
    const providerFilter = searchParams.get("provider")
    const linuxdoTL3 = searchParams.get("linuxdoTL3") === "true"
    const fingerprintHash = (searchParams.get("fingerprintHash") || "").trim()

    const conditions: Prisma.UserWhereInput[] = []

    if (search) {
      conditions.push({
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
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

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        latestFingerprintHash: true,
        latestFingerprintAt: true,
      },
    })

    const header = [
      "id",
      "email",
      "name",
      "role",
      "status",
      "createdAt",
      "latestFingerprintHash",
      "latestFingerprintAt",
    ]

    const rows: unknown[][] = [
      header,
      ...users.map((item) => [
        item.id,
        item.email,
        item.name || "",
        item.role,
        item.status,
        item.createdAt.toISOString(),
        item.latestFingerprintHash || "",
        item.latestFingerprintAt?.toISOString() || "",
      ]),
    ]

    const csv = toCsv(rows)
    const filename = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Admin user export error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.users.failedToFetch, {
      status: 500,
    })
  }
}

