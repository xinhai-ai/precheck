const SUPER_ADMIN_ROLE = "SUPER_ADMIN"

export const MAX_PRE_APPLICATION_ADMIN_NOTE_LENGTH = 2000

export type PreApplicationAdminRole = "ADMIN" | "SUPER_ADMIN"

export function normalizePreApplicationAdminNoteContent(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  if (trimmed.length > MAX_PRE_APPLICATION_ADMIN_NOTE_LENGTH) {
    return null
  }

  return trimmed
}

export function canManagePreApplicationAdminNote(input: {
  actorRole: PreApplicationAdminRole
  actorId: string
  createdById: string
}): boolean {
  if (input.actorRole === SUPER_ADMIN_ROLE) {
    return true
  }

  return input.actorId === input.createdById
}
