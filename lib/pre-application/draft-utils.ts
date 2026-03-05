export const DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH = 300

const PRE_APPLICATION_SOURCES = ["TIEBA", "BILIBILI", "DOUYIN", "XIAOHONGSHU", "OTHER"] as const

type PreApplicationSourceValue = (typeof PRE_APPLICATION_SOURCES)[number]

export type PreApplicationDraftInput = {
  essay?: unknown
  source?: unknown
  sourceDetail?: unknown
  registerEmail?: unknown
  group?: unknown
}

export type NormalizedPreApplicationDraftPayload = {
  essay: string
  source: PreApplicationSourceValue | null
  sourceDetail: string | null
  registerEmail: string
  group: string
}

function normalizeOptionalString(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function normalizeSource(value: unknown): PreApplicationSourceValue | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toUpperCase()
  if (PRE_APPLICATION_SOURCES.includes(normalized as PreApplicationSourceValue)) {
    return normalized as PreApplicationSourceValue
  }

  return null
}

export function normalizePreApplicationDraftPayload(
  input: PreApplicationDraftInput,
): NormalizedPreApplicationDraftPayload {
  const source = normalizeSource(input.source)
  const sourceDetailRaw = normalizeOptionalString(input.sourceDetail)

  return {
    essay: normalizeOptionalString(input.essay),
    source,
    sourceDetail: source === "OTHER" && sourceDetailRaw ? sourceDetailRaw : null,
    registerEmail: normalizeOptionalString(input.registerEmail),
    group: normalizeOptionalString(input.group),
  }
}

function normalizeEssayMaxLength(maxLength: number): number {
  if (!Number.isFinite(maxLength)) {
    return DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH
  }

  const normalized = Math.floor(maxLength)
  if (normalized < 1) {
    return DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH
  }

  return normalized
}

export function isPreApplicationDraftEssayTooLong(essay: string, maxLength: number): boolean {
  const safeMaxLength = normalizeEssayMaxLength(maxLength)
  return essay.length > safeMaxLength
}
