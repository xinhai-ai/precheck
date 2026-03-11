import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { createApiErrorResponse } from "@/lib/api/error-response"
import { ApiErrorKeys } from "@/lib/api/error-keys"
import { calculateSimilarity, quickSimilarityCheck } from "@/lib/text-similarity"

interface DuplicateRecord {
  id: string
  similarity: number
  essay: string
  user: { name: string | null; email: string } | null
  registerEmail: string
  createdAt: Date
  status: string
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    const currentRecord = await db.preApplication.findUnique({
      where: { id },
      select: {
        id: true,
        essay: true,
      },
    })

    if (!currentRecord) {
      return createApiErrorResponse(request, ApiErrorKeys.general.notFound, { status: 404 })
    }

    const otherRecords = await db.preApplication.findMany({
      where: {
        id: { not: id },
      },
      select: {
        id: true,
        essay: true,
        createdAt: true,
        status: true,
        registerEmail: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000,
    })

    const candidates: Array<{
      record: (typeof otherRecords)[0]
      textSimilarity: number
    }> = []

    for (const record of otherRecords) {
      if (!quickSimilarityCheck(currentRecord.essay, record.essay, 25)) {
        continue
      }

      const textSimilarity = calculateSimilarity(currentRecord.essay, record.essay)
      if (textSimilarity >= 30) {
        candidates.push({ record, textSimilarity })
      }
    }

    candidates.sort((a, b) => b.textSimilarity - a.textSimilarity)

    const duplicates: DuplicateRecord[] = candidates
      .slice(0, 10)
      .filter(({ textSimilarity }) => textSimilarity >= 35)
      .map(({ record, textSimilarity }) => ({
        id: record.id,
        similarity: Math.round(textSimilarity),
        essay: record.essay,
        user: record.user,
        registerEmail: record.registerEmail,
        createdAt: record.createdAt,
        status: record.status,
      }))

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      records: duplicates.slice(0, 5),
      totalCandidates: candidates.length,
    })
  } catch (error) {
    console.error("Duplicate check error:", error)
    return createApiErrorResponse(
      request,
      ApiErrorKeys.admin.preApplications.duplicateCheckFailed,
      { status: 500 },
    )
  }
}
