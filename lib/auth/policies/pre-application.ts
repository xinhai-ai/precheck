import type { Role } from "@prisma/client"
import { hasCapability } from "../capabilities"

export type PreApplicationPolicyActor = {
  id: string
  role: Role | null
}

export type PreApplicationPolicyReason = "MISSING_CAPABILITY" | "PENDING_APPEAL_EXISTS"

export type PreApplicationPolicyResult =
  | { allowed: true; reason: null }
  | { allowed: false; reason: PreApplicationPolicyReason }

export function canReviewPreApplication(
  actor: Pick<PreApplicationPolicyActor, "role"> | null | undefined,
): PreApplicationPolicyResult {
  if (!hasCapability(actor?.role, "preApplication.review")) {
    return { allowed: false, reason: "MISSING_CAPABILITY" }
  }

  return { allowed: true, reason: null }
}

export function canArchivePreApplication(
  actor: Pick<PreApplicationPolicyActor, "role"> | null | undefined,
  context: { pendingAppealCount: number },
): PreApplicationPolicyResult {
  if (!hasCapability(actor?.role, "preApplication.archive")) {
    return { allowed: false, reason: "MISSING_CAPABILITY" }
  }

  if (context.pendingAppealCount > 0) {
    return { allowed: false, reason: "PENDING_APPEAL_EXISTS" }
  }

  return { allowed: true, reason: null }
}
