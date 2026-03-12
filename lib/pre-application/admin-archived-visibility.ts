export type AdminVisibleRole = "USER" | "ADMIN" | "SUPER_ADMIN" | null | undefined

export const ARCHIVED_PRE_APPLICATION_STATUS = "ARCHIVED" as const

export function canViewArchivedPreApplications(role: AdminVisibleRole): boolean {
  return role === "SUPER_ADMIN"
}

export function shouldHidePreApplicationFromAdmin(
  status: string | null | undefined,
  role: AdminVisibleRole,
): boolean {
  return status === ARCHIVED_PRE_APPLICATION_STATUS && !canViewArchivedPreApplications(role)
}

export function filterAdminVisiblePreApplicationStatuses<T extends string>(
  statuses: readonly T[],
  role: AdminVisibleRole,
): T[] {
  return statuses.filter(
    (status) => status !== ARCHIVED_PRE_APPLICATION_STATUS || canViewArchivedPreApplications(role),
  )
}
