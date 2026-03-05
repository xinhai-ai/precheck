import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PreApplicationSource } from "@prisma/client"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { getEssayLengthLimits } from "@/lib/pre-application/essay-limits"
import {
  isPreApplicationDraftEssayTooLong,
  normalizePreApplicationDraftPayload,
} from "@/lib/pre-application/draft-utils"
import { getQQGroups } from "@/lib/qq-groups"

const draftPayloadSchema = z.object({
  essay: z.string().nullable().optional(),
  source: z.nativeEnum(PreApplicationSource).nullable().optional(),
  sourceDetail: z.string().max(100).nullable().optional(),
  registerEmail: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
})

async function isValidGroupId(groupId: string): Promise<boolean> {
  const groups = await getQQGroups()
  return groups.some((group) => group.id === groupId)
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

    const draft = await db.preApplicationDraft.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({ draft })
  } catch (error) {
    console.error("Pre-application draft fetch error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToLoadDraft, {
      status: 500,
    })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    const body = await request.json()
    const parsed = draftPayloadSchema.parse(body)
    const normalized = normalizePreApplicationDraftPayload(parsed)
    const limits = await getEssayLengthLimits()

    if (isPreApplicationDraftEssayTooLong(normalized.essay, limits.max)) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.draftTooLong, {
        status: 400,
      })
    }

    if (normalized.group && !(await isValidGroupId(normalized.group))) {
      return createApiErrorResponse(request, ApiErrorKeys.preApplication.invalidGroup, {
        status: 400,
      })
    }

    const draft = await db.preApplicationDraft.upsert({
      where: { userId: user.id },
      update: {
        essay: normalized.essay,
        source: normalized.source as PreApplicationSource | null,
        sourceDetail: normalized.sourceDetail,
        registerEmail: normalized.registerEmail,
        group: normalized.group,
      },
      create: {
        userId: user.id,
        essay: normalized.essay,
        source: normalized.source as PreApplicationSource | null,
        sourceDetail: normalized.sourceDetail,
        registerEmail: normalized.registerEmail,
        group: normalized.group,
      },
    })

    return NextResponse.json({ draft })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
        status: 400,
        meta: { detail: error.errors[0].message },
      })
    }

    console.error("Pre-application draft save error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToSaveDraft, {
      status: 500,
    })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return createApiErrorResponse(request, ApiErrorKeys.notAuthenticated, { status: 401 })
    }

    if (!db) {
      return createApiErrorResponse(request, ApiErrorKeys.databaseNotConfigured, { status: 503 })
    }

    await db.preApplicationDraft.deleteMany({
      where: { userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Pre-application draft delete error:", error)
    return createApiErrorResponse(request, ApiErrorKeys.preApplication.failedToDeleteDraft, {
      status: 500,
    })
  }
}
