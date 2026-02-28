import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return createApiErrorResponse(request, ApiErrorKeys.general.forbidden, { status: 403 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const { id } = await context.params

    const current = await db.preApplication.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        fingerprintHash: true,
        fingerprintStatus: true,
        fingerprintCollectedAt: true,
      },
    })

    if (!current) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    if (!current.fingerprintHash) {
      return NextResponse.json({
        id: current.id,
        fingerprintHash: null,
        fingerprintStatus: current.fingerprintStatus,
        fingerprintCollectedAt: current.fingerprintCollectedAt,
        relatedUsersCount: 0,
        relatedApplicationsCount: 0,
        relatedUsers: [],
        relatedApplications: [],
      })
    }

    const [relatedUsers, relatedApplications, relatedUsersCount, relatedApplicationsCount] =
      await Promise.all([
        db.user.findMany({
          where: { latestFingerprintHash: current.fingerprintHash },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            latestFingerprintAt: true,
            createdAt: true,
          },
        }),
        db.preApplication.findMany({
          where: {
            id: { not: current.id },
            fingerprintHash: current.fingerprintHash,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            registerEmail: true,
            status: true,
            queryToken: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        db.user.count({
          where: { latestFingerprintHash: current.fingerprintHash },
        }),
        db.preApplication.count({
          where: { fingerprintHash: current.fingerprintHash },
        }),
      ])

    return NextResponse.json({
      id: current.id,
      fingerprintHash: current.fingerprintHash,
      fingerprintStatus: current.fingerprintStatus,
      fingerprintCollectedAt: current.fingerprintCollectedAt,
      relatedUsersCount,
      relatedApplicationsCount,
      relatedUsers,
      relatedApplications,
    })
  } catch (error) {
    console.error("Admin pre-application fingerprint detail error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.admin.preApplications.failedToFetch, {
      status: 500,
    })
  }
}

