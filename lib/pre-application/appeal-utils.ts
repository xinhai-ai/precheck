import { getSubmitBanUntilFromDays } from "./submit-ban-utils.ts"

export const PRE_APPLICATION_APPEAL_COOLDOWN_DAYS = 3
export const PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS = 7

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

interface AppealSnapshotUser {
  id: string
  name: string | null
  email: string
}

interface AppealRejectionSnapshotSource {
  status: string
  essay: string
  guidance: string | null
  reviewedAt: Date | string | null | undefined
  reviewedBy: AppealSnapshotUser | null
}

interface AppealRejectionSnapshotVersion extends AppealRejectionSnapshotSource {
  createdAt: Date | string | null | undefined
}

export interface PreApplicationAppealRejectionSnapshot {
  essay: string
  guidance: string | null
  reviewedAt: Date | string | null
  reviewedBy: AppealSnapshotUser | null
}

export interface GetAppealRejectionSnapshotInput {
  appealCreatedAt: Date | string
  preApplication: AppealRejectionSnapshotSource | null | undefined
  versions?: AppealRejectionSnapshotVersion[] | null | undefined
}

export interface FindMatchingAppealAutoRejectPatternInput {
  guidance: string | null | undefined
  patterns: string[]
}

function getDateMs(value: Date | string | null | undefined, errorMessage: string): number | null {
  if (value === null || value === undefined) {
    return null
  }

  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(ms)) {
    throw new Error(errorMessage)
  }

  return ms
}

function getAppealCreatedAtMs(lastAppealedAt: Date | string | null | undefined): number | null {
  return getDateMs(lastAppealedAt, "Invalid appeal createdAt")
}

function toRejectionSnapshot(
  source: AppealRejectionSnapshotSource,
): PreApplicationAppealRejectionSnapshot {
  return {
    essay: source.essay,
    guidance: source.guidance,
    reviewedAt: source.reviewedAt ?? null,
    reviewedBy: source.reviewedBy,
  }
}

export function normalizeAppealAutoRejectPatterns(patterns: string[]): string[] {
  return patterns
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => {
      void new RegExp(pattern, "u")
      return pattern
    })
}

export function findMatchingAppealAutoRejectPattern({
  guidance,
  patterns,
}: FindMatchingAppealAutoRejectPatternInput): string | null {
  if (!guidance) {
    return null
  }

  const normalizedPatterns = normalizeAppealAutoRejectPatterns(patterns)
  return normalizedPatterns.find((pattern) => new RegExp(pattern, "u").test(guidance)) ?? null
}

export function getAppealRejectionSnapshot({
  appealCreatedAt,
  preApplication,
  versions,
}: GetAppealRejectionSnapshotInput): PreApplicationAppealRejectionSnapshot | null {
  const appealCreatedAtMs = getDateMs(appealCreatedAt, "Invalid appeal createdAt")

  if (appealCreatedAtMs === null) {
    return null
  }

  const matchedVersion = (versions ?? [])
    .filter((version) => version.status === "REJECTED")
    .map((version) => ({
      version,
      createdAtMs: getDateMs(version.createdAt, "Invalid rejection snapshot createdAt"),
    }))
    .filter(
      (entry): entry is { version: AppealRejectionSnapshotVersion; createdAtMs: number } =>
        entry.createdAtMs !== null && entry.createdAtMs <= appealCreatedAtMs,
    )
    .sort((left, right) => right.createdAtMs - left.createdAtMs)[0]?.version

  if (matchedVersion) {
    return toRejectionSnapshot(matchedVersion)
  }

  if (!preApplication || preApplication.status !== "REJECTED") {
    return null
  }

  const preApplicationReviewedAtMs = getDateMs(
    preApplication.reviewedAt,
    "Invalid rejection snapshot reviewedAt",
  )

  if (preApplicationReviewedAtMs !== null && preApplicationReviewedAtMs > appealCreatedAtMs) {
    return null
  }

  return toRejectionSnapshot(preApplication)
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
  banDaysOrNow: number | Date = PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
  now: Date = new Date(),
): Date {
  const hasLegacySignature = banDaysOrNow instanceof Date
  const banDays = hasLegacySignature ? PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS : banDaysOrNow
  const currentNow = hasLegacySignature ? banDaysOrNow : now
  const nextBannedUntil = getSubmitBanUntilFromDays(banDays, currentNow)

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
