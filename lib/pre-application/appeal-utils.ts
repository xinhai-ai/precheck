import { getSubmitBanUntilFromDays } from "./submit-ban-utils.ts"

export const PRE_APPLICATION_APPEAL_COOLDOWN_DAYS = 3
export const PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS = 3

const SECONDS_PER_DAY = 24 * 60 * 60
const PRE_APPLICATION_APPEAL_COOLDOWN_SECONDS =
  PRE_APPLICATION_APPEAL_COOLDOWN_DAYS * SECONDS_PER_DAY

export type PreApplicationAppealAvailabilityReason =
  | "APPEAL_DISABLED"
  | "PRE_APPLICATION_NOT_REJECTED"
  | "PENDING_APPEAL_EXISTS"
  | "APPEAL_COOLDOWN_ACTIVE"

export interface PreApplicationAppealAvailability {
  canCreate: boolean
  reason: PreApplicationAppealAvailabilityReason | null
  cooldownRemainingSeconds: number
}

export interface GetPreApplicationAppealAvailabilityInput {
  appealEnabled: boolean
  preApplicationStatus: string | null | undefined
  hasPendingAppeal: boolean
  lastAppealCreatedAt: Date | string | null | undefined
  now?: Date
}

function getAppealCreatedAtMs(lastAppealedAt: Date | string | null | undefined): number | null {
  if (lastAppealedAt === null || lastAppealedAt === undefined) {
    return null
  }

  const ms =
    lastAppealedAt instanceof Date ? lastAppealedAt.getTime() : new Date(lastAppealedAt).getTime()
  if (!Number.isFinite(ms)) {
    throw new Error("Invalid appeal createdAt")
  }

  return ms
}

export function getAppealCooldownRemainingSeconds(
  lastAppealedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  const ms = getAppealCreatedAtMs(lastAppealedAt)
  if (ms === null) return 0

  return Math.max(
    0,
    Math.ceil((ms + PRE_APPLICATION_APPEAL_COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000),
  )
}

export function getAppealRejectSubmitBanUntil(
  existingBannedUntil: Date | string | null | undefined,
  now: Date = new Date(),
): Date {
  const nextBannedUntil = getSubmitBanUntilFromDays(PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS, now)

  if (!existingBannedUntil) {
    return nextBannedUntil
  }

  const existingMs =
    existingBannedUntil instanceof Date
      ? existingBannedUntil.getTime()
      : new Date(existingBannedUntil).getTime()

  if (!Number.isFinite(existingMs) || existingMs <= nextBannedUntil.getTime()) {
    return nextBannedUntil
  }

  return new Date(existingMs)
}

export function getPreApplicationAppealAvailability({
  appealEnabled,
  preApplicationStatus,
  hasPendingAppeal,
  lastAppealCreatedAt,
  now = new Date(),
}: GetPreApplicationAppealAvailabilityInput): PreApplicationAppealAvailability {
  if (!appealEnabled) {
    return {
      canCreate: false,
      reason: "APPEAL_DISABLED",
      cooldownRemainingSeconds: 0,
    }
  }

  if (preApplicationStatus !== "REJECTED") {
    return {
      canCreate: false,
      reason: "PRE_APPLICATION_NOT_REJECTED",
      cooldownRemainingSeconds: 0,
    }
  }

  if (hasPendingAppeal) {
    return {
      canCreate: false,
      reason: "PENDING_APPEAL_EXISTS",
      cooldownRemainingSeconds: 0,
    }
  }

  const cooldownRemainingSeconds = getAppealCooldownRemainingSeconds(lastAppealCreatedAt, now)
  if (cooldownRemainingSeconds > 0) {
    return {
      canCreate: false,
      reason: "APPEAL_COOLDOWN_ACTIVE",
      cooldownRemainingSeconds,
    }
  }

  return {
    canCreate: true,
    reason: null,
    cooldownRemainingSeconds: 0,
  }
}
