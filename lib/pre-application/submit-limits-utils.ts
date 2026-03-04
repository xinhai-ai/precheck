export const SHANGHAI_UTC_OFFSET_MINUTES = 8 * 60

export const DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT = 30
export const DEFAULT_PREAPP_DAILY_USER_LIMIT = 5
export const DEFAULT_PREAPP_SUBMIT_START_TIME = "09:00"
export const DEFAULT_PREAPP_SUBMIT_END_TIME = "21:00"

const HARD_MIN_LIMIT = 1
const HARD_MAX_LIMIT = 1_000_000
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export type PreApplicationSubmitLimits = {
  dailyGlobalLimit: number
  dailyUserLimit: number
  submitStartTime: string
  submitEndTime: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null
  }
  return value
}

function normalizeLimit(value: number | null | undefined, fallback: number): number {
  const parsed = toInt(value)
  if (parsed === null) return fallback
  return clamp(parsed, HARD_MIN_LIMIT, HARD_MAX_LIMIT)
}

export function parseSubmitTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour * 60 + minute
}

export function isValidSubmitWindow(startHm: string, endHm: string): boolean {
  const startMinutes = parseSubmitTimeToMinutes(startHm)
  const endMinutes = parseSubmitTimeToMinutes(endHm)
  if (startMinutes === null || endMinutes === null) return false
  return startMinutes < endMinutes
}

function normalizeSubmitTime(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback
  return TIME_PATTERN.test(value) ? value : fallback
}

export function normalizeSubmitLimits(input: {
  dailyGlobalLimit?: number | null
  dailyUserLimit?: number | null
  submitStartTime?: string | null
  submitEndTime?: string | null
}): PreApplicationSubmitLimits {
  const dailyGlobalLimit = normalizeLimit(
    input.dailyGlobalLimit,
    DEFAULT_PREAPP_DAILY_GLOBAL_LIMIT,
  )

  const dailyUserLimit = normalizeLimit(input.dailyUserLimit, DEFAULT_PREAPP_DAILY_USER_LIMIT)

  const submitStartTime = normalizeSubmitTime(
    input.submitStartTime,
    DEFAULT_PREAPP_SUBMIT_START_TIME,
  )

  const submitEndTime = normalizeSubmitTime(input.submitEndTime, DEFAULT_PREAPP_SUBMIT_END_TIME)

  if (!isValidSubmitWindow(submitStartTime, submitEndTime)) {
    return {
      dailyGlobalLimit,
      dailyUserLimit,
      submitStartTime: DEFAULT_PREAPP_SUBMIT_START_TIME,
      submitEndTime: DEFAULT_PREAPP_SUBMIT_END_TIME,
    }
  }

  return {
    dailyGlobalLimit,
    dailyUserLimit,
    submitStartTime,
    submitEndTime,
  }
}

function toShanghaiPseudoDate(now: Date): Date {
  return new Date(now.getTime() + SHANGHAI_UTC_OFFSET_MINUTES * 60 * 1000)
}

function formatDayKeyFromPseudoDate(value: Date): string {
  const year = value.getUTCFullYear()
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0")
  const day = `${value.getUTCDate()}`.padStart(2, "0")
  return `${year}${month}${day}`
}

export function getShanghaiDayQuotaInfo(now: Date): { dayKey: string; ttlSeconds: number } {
  const shanghaiNow = toShanghaiPseudoDate(now)
  const dayKey = formatDayKeyFromPseudoDate(shanghaiNow)

  const nextShanghaiMidnightPseudoMs = Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  )

  const nextShanghaiMidnightUtcMs =
    nextShanghaiMidnightPseudoMs - SHANGHAI_UTC_OFFSET_MINUTES * 60 * 1000

  const ttlSeconds = Math.max(1, Math.ceil((nextShanghaiMidnightUtcMs - now.getTime()) / 1000))

  return { dayKey, ttlSeconds }
}

export function isWithinShanghaiSubmitWindow(
  now: Date,
  submitStartTime: string,
  submitEndTime: string,
): boolean {
  const normalized = normalizeSubmitLimits({
    submitStartTime,
    submitEndTime,
  })

  const startMinutes = parseSubmitTimeToMinutes(normalized.submitStartTime)
  const endMinutes = parseSubmitTimeToMinutes(normalized.submitEndTime)

  if (startMinutes === null || endMinutes === null) {
    return false
  }

  const shanghaiNow = toShanghaiPseudoDate(now)
  const currentMinutes = shanghaiNow.getUTCHours() * 60 + shanghaiNow.getUTCMinutes()

  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}
