import type { NextRequest } from "next/server"
import { Prisma, type PrismaClient } from "@prisma/client"
import { extractRequestMeta } from "@/lib/audit"
import { getFingerprintPepper } from "@/lib/fingerprint/hash"
import { buildFingerprintBinding } from "@/lib/fingerprint/components"
import { buildNetworkKey, normalizeBrowserFamily } from "@/lib/fingerprint/metadata"
import { selectBestFingerprintSimilarity } from "@/lib/fingerprint/similarity"
import { assignFingerprintRiskCluster } from "@/lib/risk-control/fingerprint-cluster"
import type {
  FingerprintComponents,
  FingerprintEventType,
  FingerprintPayload,
} from "@/lib/fingerprint/types"

type RecordFingerprintEventInput = {
  db: PrismaClient
  eventType: FingerprintEventType
  payload: FingerprintPayload
  request?: Request | NextRequest
  userId?: string | null
  preApplicationId?: string | null
  pepper?: string
}

type NormalizedFingerprint = {
  status: "OK" | "COLLECTION_FAILED"
  fingerprintHash: string | null
  failureReason: string | null
  components: ReturnType<typeof buildFingerprintBinding>["components"]
  componentKeys: string[]
  basis: ReturnType<typeof buildFingerprintBinding>["basis"]
  summary: ReturnType<typeof buildFingerprintBinding>["summary"]
}

export function normalizeFingerprintPayload(
  payload: FingerprintPayload,
  pepper: string = getFingerprintPepper(),
): NormalizedFingerprint {
  const binding = buildFingerprintBinding(
    payload.fingerprintComponents,
    pepper,
    payload.fingerprintVisitorId,
  )

  if (payload.fingerprintStatus === "OK" && binding.fingerprintHash) {
    return {
      status: "OK",
      fingerprintHash: binding.fingerprintHash,
      failureReason: null,
      components: binding.components,
      componentKeys: binding.componentKeys,
      basis: binding.basis,
      summary: binding.summary,
    }
  }

  return {
    status: "COLLECTION_FAILED",
    fingerprintHash: null,
    failureReason: payload.fingerprintFailureReason?.trim() || "collection_failed",
    components: binding.components,
    componentKeys: binding.componentKeys,
    basis: binding.basis,
    summary: binding.summary,
  }
}

export async function recordFingerprintEvent(input: RecordFingerprintEventInput) {
  if (process.env.FEATURE_FINGERPRINT === "false") {
    return null
  }

  try {
    const normalized = normalizeFingerprintPayload(input.payload, input.pepper)
    const { ip, userAgent } = extractRequestMeta(input.request)
    const browserFamily = normalizeBrowserFamily(userAgent)
    const networkKey = buildNetworkKey(ip)
    const now = new Date()
    const hasComponents = normalized.componentKeys.length > 0

    const similarityCandidates = hasComponents
      ? await input.db.fingerprintEvent.findMany({
          where: {
            fingerprintComponents: { not: Prisma.DbNull },
            ...(normalized.fingerprintHash
              ? {
                  OR: [
                    { fingerprintHash: null },
                    { fingerprintHash: { not: normalized.fingerprintHash } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            fingerprintHash: true,
            fingerprintComponents: true,
          },
        })
      : []

    const bestSimilarity = selectBestFingerprintSimilarity(
      normalized.components,
      similarityCandidates.map((item) => ({
        id: item.id,
        fingerprintHash: item.fingerprintHash,
        fingerprintComponents: item.fingerprintComponents as FingerprintComponents | null,
      })),
    )

    let fingerprintId: string | null = null

    if (normalized.fingerprintHash) {
      const profile = await input.db.fingerprintProfile.upsert({
        where: { fingerprintHash: normalized.fingerprintHash },
        create: {
          fingerprintHash: normalized.fingerprintHash,
          fingerprintBasis: hasComponents ? (normalized.basis as Prisma.InputJsonValue) : undefined,
          componentKeys: normalized.componentKeys,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          fingerprintBasis: hasComponents ? (normalized.basis as Prisma.InputJsonValue) : undefined,
          componentKeys: normalized.componentKeys,
          lastSeenAt: now,
        },
        select: { id: true },
      })
      fingerprintId = profile.id
    }

    const createdEvent = await input.db.fingerprintEvent.create({
      data: {
        fingerprintId,
        fingerprintHash: normalized.fingerprintHash,
        eventType: input.eventType,
        status: normalized.status,
        failureReason: normalized.failureReason,
        userId: input.userId ?? null,
        preApplicationId: input.preApplicationId ?? null,
        ip,
        userAgent,
        browserFamily,
        networkKey,
        fingerprintComponents: hasComponents
          ? (normalized.components as Prisma.InputJsonValue)
          : undefined,
        fingerprintSummary: hasComponents
          ? (normalized.summary as Prisma.InputJsonValue)
          : undefined,
        similarityScore: bestSimilarity.score > 0 ? bestSimilarity.score : null,
        similaritySignals:
          bestSimilarity.score > 0
            ? (bestSimilarity.signals as unknown as Prisma.InputJsonValue)
            : undefined,
      },
      select: { id: true },
    })

    if (input.userId && normalized.fingerprintHash) {
      await input.db.user.update({
        where: { id: input.userId },
        data: {
          latestFingerprintHash: normalized.fingerprintHash,
          latestFingerprintAt: now,
        },
      })
    }

    if (input.preApplicationId) {
      await input.db.preApplication.update({
        where: { id: input.preApplicationId },
        data: normalized.fingerprintHash
          ? {
              fingerprintHash: normalized.fingerprintHash,
              fingerprintCollectedAt: now,
              fingerprintStatus: "OK",
            }
          : {
              fingerprintHash: null,
              fingerprintCollectedAt: null,
              fingerprintStatus: "COLLECTION_FAILED",
            },
      })
    }

    await assignFingerprintRiskCluster({
      db: input.db,
      eventId: createdEvent.id,
    })

    return normalized
  } catch (error) {
    console.error("[fingerprint] failed to record event:", error)
    return null
  }
}
