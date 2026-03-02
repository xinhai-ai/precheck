export const DEFAULT_ESSAY_MIN_LENGTH = 50
export const DEFAULT_ESSAY_MAX_LENGTH = 300

const HARD_MIN_ESSAY_LENGTH = 1
const HARD_MAX_ESSAY_LENGTH = 5000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null
  }
  return value
}

export function normalizeEssayLengthLimits(
  configuredMin: number | null | undefined,
  configuredMax: number | null | undefined,
): { min: number; max: number } {
  const min = clamp(
    toInt(configuredMin) ?? DEFAULT_ESSAY_MIN_LENGTH,
    HARD_MIN_ESSAY_LENGTH,
    HARD_MAX_ESSAY_LENGTH,
  )

  const max = clamp(
    toInt(configuredMax) ?? DEFAULT_ESSAY_MAX_LENGTH,
    HARD_MIN_ESSAY_LENGTH,
    HARD_MAX_ESSAY_LENGTH,
  )

  if (min > max) {
    return {
      min: DEFAULT_ESSAY_MIN_LENGTH,
      max: DEFAULT_ESSAY_MAX_LENGTH,
    }
  }

  return { min, max }
}
