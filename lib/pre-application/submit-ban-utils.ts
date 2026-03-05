export const PRE_APPLICATION_SUBMIT_BAN_MIN_DAYS = 1
export const PRE_APPLICATION_SUBMIT_BAN_MAX_DAYS = 3650

const SECONDS_PER_DAY = 24 * 60 * 60

export function normalizeSubmitBanDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null
  }

  if (value < PRE_APPLICATION_SUBMIT_BAN_MIN_DAYS || value > PRE_APPLICATION_SUBMIT_BAN_MAX_DAYS) {
    return null
  }

  return value
}

export function getSubmitBanUntilFromDays(days: number, now: Date = new Date()): Date {
  const normalizedDays = normalizeSubmitBanDays(days)
  if (normalizedDays === null) {
    throw new Error("Invalid submit ban days")
  }

  return new Date(now.getTime() + normalizedDays * SECONDS_PER_DAY * 1000)
}

export function getSubmitBanRemainingSeconds(
  bannedUntil: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  if (!bannedUntil) return 0

  const ms = bannedUntil instanceof Date ? bannedUntil.getTime() : new Date(bannedUntil).getTime()
  if (!Number.isFinite(ms)) return 0

  return Math.max(0, Math.ceil((ms - now.getTime()) / 1000))
}

export function isSubmitBanActive(
  bannedUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  return getSubmitBanRemainingSeconds(bannedUntil, now) > 0
}
