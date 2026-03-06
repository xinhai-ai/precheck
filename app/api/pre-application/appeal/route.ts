import { type NextRequest, NextResponse } from "next/server"
import { Prisma, PreApplicationAppealStatus } from "@prisma/client"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit"
import { getCurrentUser } from "@/lib/auth/session"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { db } from "@/lib/db"
import { getPreApplicationAppealAvailability } from "@/lib/pre-application/appeal-utils"

const createPreApplicationAppealSchema = z.object({
  preApplicationId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2000),
})

const userSelect = {
  id: true,
  name: true,
  email: true,
} as const

const appealSelect = {
  id: true,
  preApplicationId: true,
  userId: true,
  status: true,
  reason: true,
  reviewedAt: true,
  reviewComment: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: { select: userSelect },
} as const

const preApplicationWithAppealsSelect = {
  id: true,
  status: true,
  guidance: true,
  queryToken: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  reviewedBy: { select: userSelect },
  appeals: {
    orderBy: { createdAt: "desc" as const },
    select: appealSelect,
  },
} as const

async function isPreApplicationAppealEnabled(): Promise<boolean> {
  if (!db) {
    return false
  }

  const settings = await db.siteSettings.findUnique({
    where: { id: "global" },
    select: { preApplicationAppealEnabled: true },
  })

  return settings?.preApplicationAppealEnabled ?? false
}

function getAppealAvailability(
  appealEnabled: boolean,
  preApplication: {
    status: string
    appeals: Array<{ status: PreApplicationAppealStatus; createdAt: Date }>
  } | null,
) {
  const appeals = preApplication?.appeals ?? []

  return getPreApplicationAppealAvailability({
    appealEnabled,
    preApplicationStatus: preApplication?.status,
    hasPendingAppeal: appeals.some(
      (appeal) => appeal.status === PreApplicationAppealStatus.PENDING,
    ),
    lastAppealCreatedAt: appeals[0]?.createdAt ?? null,
  })
}

function createAppealAvailabilityErrorResponse(
  request: NextRequest,
  availability: ReturnType<typeof getAppealAvailability>,
) {
  switch (availability.reason) {
    case "APPEAL_DISABLED":
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.disabled, {
        status: 403,
      })
    case "PRE_APPLICATION_NOT_REJECTED":
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.preApplicationNotRejected,
        {
          status: 409,
        },
      )
    case "PENDING_APPEAL_EXISTS":
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.pendingAppealExists,
        {
          status: 409,
        },
      )
    case "APPEAL_COOLDOWN_ACTIVE":
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.cooldownActive, {
        status: 429,
        meta: {
          remainingSeconds: availability.cooldownRemainingSeconds,
        },
      })
    default:
      return createApiErrorResponse(request, ApiErrorKeys.general.failed, {
        status: 409,
      })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const [appealEnabled, preApplication] = await Promise.all([
      isPreApplicationAppealEnabled(),
      db.preApplication.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: preApplicationWithAppealsSelect,
      }),
    ])

    const appeals = preApplication?.appeals ?? []
    const preApplicationRecord =
      preApplication === null
        ? null
        : {
            id: preApplication.id,
            status: preApplication.status,
            guidance: preApplication.guidance,
            queryToken: preApplication.queryToken,
            reviewedAt: preApplication.reviewedAt,
            createdAt: preApplication.createdAt,
            updatedAt: preApplication.updatedAt,
            reviewedBy: preApplication.reviewedBy,
          }

    return NextResponse.json({
      preApplication: preApplicationRecord,
      appeals,
      availability: getAppealAvailability(appealEnabled, preApplication),
    })
  } catch (error) {
    console.error("Pre-application appeal fetch error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.failedToFetch, {
      status: 500,
    })
  }
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
    const data = createPreApplicationAppealSchema.parse(body)

    const [appealEnabled, preApplication] = await Promise.all([
      isPreApplicationAppealEnabled(),
      db.preApplication.findFirst({
        where: {
          id: data.preApplicationId,
          userId: user.id,
        },
        select: preApplicationWithAppealsSelect,
      }),
    ])

    if (!preApplication) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.noPreApplicationFound, {
        status: 404,
      })
    }

    const availability = getAppealAvailability(appealEnabled, preApplication)
    if (!availability.canCreate) {
      return createAppealAvailabilityErrorResponse(request, availability)
    }

    const appeal = await db.$transaction(async (tx) => {
      const created = await tx.preApplicationAppeal.create({
        data: {
          preApplicationId: preApplication.id,
          userId: user.id,
          status: PreApplicationAppealStatus.PENDING,
          reason: data.reason,
        },
        select: appealSelect,
      })

      await writeAuditLog(tx, {
        action: "PRE_APPLICATION_APPEAL_CREATE",
        entityType: "PRE_APPLICATION_APPEAL",
        entityId: created.id,
        actor: user,
        after: created,
        metadata: {
          preApplicationId: preApplication.id,
        },
        request,
      })

      return created
    })

    return NextResponse.json({ appeal })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return createApiErrorResponse(
        request,
        ApiErrorKeys.preApplication.appeal.pendingAppealExists,
        {
          status: 409,
        },
      )
    }

    console.error("Pre-application appeal create error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.appeal.failedToCreate, {
      status: 500,
    })
  }
}
