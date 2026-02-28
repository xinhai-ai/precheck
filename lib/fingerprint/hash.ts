import { createHash } from "crypto"

export function hashFingerprintVisitorId(
  visitorId: string | null | undefined,
  pepper: string,
): string | null {
  const normalized = visitorId?.trim()
  if (!normalized) return null

  return createHash("sha256").update(`${normalized}${pepper}`).digest("hex")
}

export function getFingerprintPepper(): string {
  return process.env.FINGERPRINT_PEPPER || process.env.AUTH_SECRET || ""
}

