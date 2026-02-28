import { z } from "zod"
import type { FingerprintPayload } from "@/lib/fingerprint/types"

const fingerprintPayloadSchema = z.object({
  fingerprintVisitorId: z.string().trim().min(1).max(256).optional(),
  fingerprintStatus: z.enum(["OK", "COLLECTION_FAILED"]).optional(),
  fingerprintFailureReason: z.string().trim().max(200).optional(),
})

export function parseFingerprintPayload(raw: unknown): FingerprintPayload {
  const parsed = fingerprintPayloadSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: "payload_invalid",
    }
  }

  const status = parsed.data.fingerprintStatus ?? "COLLECTION_FAILED"
  const visitorId = parsed.data.fingerprintVisitorId?.trim()
  const failureReason = parsed.data.fingerprintFailureReason?.trim()

  if (status === "OK" && !visitorId) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: failureReason || "visitor_id_missing",
    }
  }

  if (status === "COLLECTION_FAILED") {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: failureReason || "collection_failed",
    }
  }

  return {
    fingerprintStatus: "OK",
    fingerprintVisitorId: visitorId,
    fingerprintFailureReason: failureReason,
  }
}

