export const SHADOW_HIDDEN_STATUS = "SHADOW_HIDDEN" as const

export function mapStatusForUserView(status: string): string {
  return status === SHADOW_HIDDEN_STATUS ? "PENDING" : status
}

export function shouldPersistAsShadowHidden(isShadowBanned: boolean): "PENDING" | "SHADOW_HIDDEN" {
  return isShadowBanned ? SHADOW_HIDDEN_STATUS : "PENDING"
}

export function isShadowHiddenLockedForAdminMutation(status: string): boolean {
  return status === SHADOW_HIDDEN_STATUS
}
