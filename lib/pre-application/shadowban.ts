export const SHADOW_HIDDEN_STATUS = "SHADOW_HIDDEN" as const

export const SHADOW_HIDE_SOURCE_STATUSES = [
  "PENDING",
  "DISPUTED",
  "PENDING_REVIEW",
  "ON_HOLD",
] as const
const SHADOW_HIDE_SOURCE_STATUS_SET = new Set<string>(SHADOW_HIDE_SOURCE_STATUSES)

export function mapStatusForUserView(status: string, latestVersionStatus?: string): string {
  if (status !== SHADOW_HIDDEN_STATUS) {
    return status
  }

  if (!latestVersionStatus || latestVersionStatus === SHADOW_HIDDEN_STATUS) {
    return "PENDING"
  }

  return latestVersionStatus
}

export function shouldPersistAsShadowHidden(isShadowBanned: boolean): "PENDING" | "SHADOW_HIDDEN" {
  return isShadowBanned ? SHADOW_HIDDEN_STATUS : "PENDING"
}

export function isShadowHiddenLockedForAdminMutation(status: string): boolean {
  return status === SHADOW_HIDDEN_STATUS
}

export function shouldShadowHideStatus(status: string): boolean {
  return SHADOW_HIDE_SOURCE_STATUS_SET.has(status)
}
