export type RiskLevel = "LOW" | "MEDIUM" | "HIGH"

export type FingerprintRiskSortBy = "userCount" | "applicationCount" | "lastSeenAt"

export type FingerprintRiskSortOrder = "asc" | "desc"

export type FingerprintRiskGroupItem = {
  fingerprintHash: string
  userCount: number
  applicationCount: number
  lastSeenAt: string
  riskLevel: RiskLevel
}

export type FingerprintRiskGroupListResponse = {
  items: FingerprintRiskGroupItem[]
  total: number
  page: number
  limit: number
  stats: {
    high: number
    medium: number
    ignoredUsers: number
  }
}

export type FingerprintRiskDetailUser = {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  firstSeenAt: string | null
  lastSeenAt: string | null
}

export type FingerprintRiskDetailApplication = {
  id: string
  status: string
  registerEmail: string
  createdAt: string
  user: { id: string; name: string | null; email: string } | null
}

export type FingerprintRiskDetailEvent = {
  id: string
  eventType: string
  status: "OK" | "COLLECTION_FAILED"
  failureReason: string | null
  ip: string | null
  userAgent: string | null
  createdAt: string
  userId: string | null
  preApplicationId: string | null
}

export type FingerprintRiskGroupDetailResponse = {
  summary: {
    fingerprintHash: string
    userCount: number
    applicationCount: number
    lastSeenAt: string | null
    riskLevel: RiskLevel
  }
  relatedUsers: FingerprintRiskDetailUser[]
  relatedApplications: FingerprintRiskDetailApplication[]
  recentEvents: FingerprintRiskDetailEvent[]
  ignoredImpact: number
}

const DEFAULT_SORT_BY: FingerprintRiskSortBy = "lastSeenAt"
const DEFAULT_SORT_ORDER: FingerprintRiskSortOrder = "desc"

const SORT_BY_ALLOWLIST = new Set<FingerprintRiskSortBy>([
  "userCount",
  "applicationCount",
  "lastSeenAt",
])

export function computeRiskLevel(userCount: number, applicationCount: number): RiskLevel {
  if (userCount >= 3 || applicationCount >= 4) {
    return "HIGH"
  }

  if (userCount === 2 || (applicationCount >= 2 && applicationCount <= 3)) {
    return "MEDIUM"
  }

  return "LOW"
}

export function sanitizeRiskSort(
  sortBy: string | null | undefined,
  sortOrder: string | null | undefined,
): { sortBy: FingerprintRiskSortBy; sortOrder: FingerprintRiskSortOrder } {
  const normalizedSortBy = sortBy?.trim()
  const normalizedSortOrder = sortOrder?.trim().toLowerCase()

  return {
    sortBy:
      normalizedSortBy && SORT_BY_ALLOWLIST.has(normalizedSortBy as FingerprintRiskSortBy)
        ? (normalizedSortBy as FingerprintRiskSortBy)
        : DEFAULT_SORT_BY,
    sortOrder: normalizedSortOrder === "asc" ? "asc" : DEFAULT_SORT_ORDER,
  }
}

export function maskFingerprintHash(hash: string, visible: number = 8): string {
  if (!hash) return "-"
  if (hash.length <= visible * 2) return hash
  return `${hash.slice(0, visible)}...${hash.slice(-visible)}`
}
