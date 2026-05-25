import {
  PreApplicationAppealSource,
  PreApplicationAppealStatus,
  PreApplicationStatus,
  type Role,
} from "@prisma/client"
import { hasCapability } from "../capabilities"

export type PreApplicationAppealPolicyActor = {
  id: string
  role: Role | null
}

export type PreApplicationAppealReviewDeniedReason =
  | "MISSING_CAPABILITY"
  | "ARCHIVED_PRE_APPLICATION"
  | "APPEAL_ALREADY_REVIEWED"
  | "TARGET_NOT_REJECTED"
  | "ORIGINAL_REVIEWER"
  | "REVIEW_REQUEST_INITIATOR"

export type PreApplicationAppealReviewPolicy =
  | { allowed: true; reason: null }
  | { allowed: false; reason: PreApplicationAppealReviewDeniedReason }

export type PreApplicationAppealPolicyContext = {
  status: PreApplicationAppealStatus | `${PreApplicationAppealStatus}`
  source: PreApplicationAppealSource | `${PreApplicationAppealSource}`
  initiatedById: string
  preApplication: {
    status: PreApplicationStatus | `${PreApplicationStatus}`
  }
  rejectionReviewedById?: string | null
}

export function canViewPreApplicationAppeals(
  actor: Pick<PreApplicationAppealPolicyActor, "role"> | null | undefined,
): boolean {
  return hasCapability(actor?.role, "preApplicationAppeal.view")
}

export function getPreApplicationAppealReviewPolicy(input: {
  actor: PreApplicationAppealPolicyActor | null | undefined
  appeal: PreApplicationAppealPolicyContext
}): PreApplicationAppealReviewPolicy {
  const actor = input.actor

  if (!actor || !hasCapability(actor.role, "preApplicationAppeal.review")) {
    return { allowed: false, reason: "MISSING_CAPABILITY" }
  }

  if (input.appeal.preApplication.status === PreApplicationStatus.ARCHIVED) {
    return { allowed: false, reason: "ARCHIVED_PRE_APPLICATION" }
  }

  if (input.appeal.status !== PreApplicationAppealStatus.PENDING) {
    return { allowed: false, reason: "APPEAL_ALREADY_REVIEWED" }
  }

  if (input.appeal.preApplication.status !== PreApplicationStatus.REJECTED) {
    return { allowed: false, reason: "TARGET_NOT_REJECTED" }
  }

  if (input.appeal.rejectionReviewedById && input.appeal.rejectionReviewedById === actor.id) {
    return { allowed: false, reason: "ORIGINAL_REVIEWER" }
  }

  if (
    input.appeal.source === PreApplicationAppealSource.ADMIN_REVIEW_REQUEST &&
    input.appeal.initiatedById === actor.id
  ) {
    return { allowed: false, reason: "REVIEW_REQUEST_INITIATOR" }
  }

  return { allowed: true, reason: null }
}

export function getPreApplicationAppealReviewDeniedStatus(
  reason: PreApplicationAppealReviewDeniedReason,
): 403 | 409 {
  switch (reason) {
    case "MISSING_CAPABILITY":
    case "ORIGINAL_REVIEWER":
    case "REVIEW_REQUEST_INITIATOR":
      return 403
    case "ARCHIVED_PRE_APPLICATION":
    case "APPEAL_ALREADY_REVIEWED":
    case "TARGET_NOT_REJECTED":
      return 409
  }
}
