import type { NextRequest } from "next/server"
import type { PrismaClient } from "@prisma/client"
import { extractRequestMeta } from "@/lib/audit"
import { getFingerprintPepper, hashFingerprintVisitorId } from "@/lib/fingerprint/hash"
import { buildNetworkKey, normalizeBrowserFamily } from "@/lib/fingerprint/metadata"
import type { FingerprintEventType, FingerprintPayload } from "@/lib/fingerprint/types"

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
}

export function normalizeFingerprintPayload(
  payload: FingerprintPayload,
  pepper: string = getFingerprintPepper(),
): NormalizedFingerprint {
  const fingerprintHash =
    payload.fingerprintStatus === "OK"
      ? hashFingerprintVisitorId(payload.fingerprintVisitorId, pepper)
      : null

  if (fingerprintHash) {
    return {
      status: "OK",
      fingerprintHash,
      failureReason: null,
    }
  }

  return {
    status: "COLLECTION_FAILED",
    fingerprintHash: null,
    failureReason: payload.fingerprintFailureReason?.trim() || "collection_failed",
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

    let fingerprintId: string | null = null

    if (normalized.fingerprintHash) {
      const profile = await input.db.fingerprintProfile.upsert({
        where: { fingerprintHash: normalized.fingerprintHash },
        create: {
          fingerprintHash: normalized.fingerprintHash,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          lastSeenAt: now,
        },
        select: { id: true },
      })
      fingerprintId = profile.id
    }

    await input.db.fingerprintEvent.create({
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
      },
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

    return normalized
  } catch (error) {
    console.error("[fingerprint] failed to record event:", error)
    return null
  }
}
