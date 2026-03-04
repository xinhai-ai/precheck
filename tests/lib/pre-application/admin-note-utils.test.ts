import test from "node:test"
import assert from "node:assert/strict"

const {
  MAX_PRE_APPLICATION_ADMIN_NOTE_LENGTH,
  normalizePreApplicationAdminNoteContent,
  canManagePreApplicationAdminNote,
} = await import(new URL("../../../lib/pre-application/admin-note-utils.ts", import.meta.url).href)

test("normalizePreApplicationAdminNoteContent trims valid content", () => {
  const content = normalizePreApplicationAdminNoteContent("  hello admin note  ")
  assert.equal(content, "hello admin note")
})

test("normalizePreApplicationAdminNoteContent rejects empty content", () => {
  const content = normalizePreApplicationAdminNoteContent("   \n\t  ")
  assert.equal(content, null)
})

test("normalizePreApplicationAdminNoteContent rejects overly long content", () => {
  const content = normalizePreApplicationAdminNoteContent(
    "a".repeat(MAX_PRE_APPLICATION_ADMIN_NOTE_LENGTH + 1),
  )
  assert.equal(content, null)
})

test("canManagePreApplicationAdminNote allows creator", () => {
  assert.equal(
    canManagePreApplicationAdminNote({
      actorRole: "ADMIN",
      actorId: "admin-1",
      createdById: "admin-1",
    }),
    true,
  )
})

test("canManagePreApplicationAdminNote denies other admin", () => {
  assert.equal(
    canManagePreApplicationAdminNote({
      actorRole: "ADMIN",
      actorId: "admin-2",
      createdById: "admin-1",
    }),
    false,
  )
})

test("canManagePreApplicationAdminNote allows super admin override", () => {
  assert.equal(
    canManagePreApplicationAdminNote({
      actorRole: "SUPER_ADMIN",
      actorId: "super-1",
      createdById: "admin-1",
    }),
    true,
  )
})
