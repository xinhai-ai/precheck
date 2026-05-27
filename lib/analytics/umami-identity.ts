import { createHmac } from "node:crypto"
import type { Role } from "@prisma/client"

const fallbackSecret = "precheck-umami-visitor"

export function createUmamiVisitorId(userId: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || fallbackSecret
  return createHmac("sha256", secret).update(`umami:${userId}`).digest("base64url").slice(0, 40)
}

export function getUmamiRoleBucket(role: Role | string | null | undefined) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return "staff"
  }

  if (role === "USER") {
    return "member"
  }

  return "guest"
}

export function getUmamiAccountAgeBucket(createdAt: Date | string | null | undefined) {
  if (!createdAt) return "guest"

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const ageMs = Date.now() - created.getTime()
  const dayMs = 24 * 60 * 60 * 1000

  if (!Number.isFinite(ageMs) || ageMs < 0) return "unknown"
  if (ageMs < dayMs) return "new"
  if (ageMs < 7 * dayMs) return "1_7d"
  if (ageMs < 30 * dayMs) return "7_30d"

  return "30d_plus"
}
