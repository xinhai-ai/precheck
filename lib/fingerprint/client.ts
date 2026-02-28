"use client"

import type { FingerprintPayload } from "@/lib/fingerprint/types"

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 120) || "sdk_error"
  }
  return "sdk_error"
}

export async function collectFingerprint(): Promise<FingerprintPayload> {
  if (process.env.NEXT_PUBLIC_FEATURE_FINGERPRINT === "false") {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: "feature_disabled",
    }
  }

  try {
    const fpjs = await import("@fingerprintjs/fingerprintjs")
    const agent = await fpjs.load()
    const result = await agent.get()

    if (!result.visitorId?.trim()) {
      return {
        fingerprintStatus: "COLLECTION_FAILED",
        fingerprintFailureReason: "visitor_id_missing",
      }
    }

    return {
      fingerprintStatus: "OK",
      fingerprintVisitorId: result.visitorId,
    }
  } catch (error) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: toFailureReason(error),
    }
  }
}
