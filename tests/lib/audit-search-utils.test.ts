import test from "node:test"
import assert from "node:assert/strict"

const { buildAuditLogSearchFilters } = await import(new URL("../../lib/audit.ts", import.meta.url).href)

test("buildAuditLogSearchFilters includes operator fields", () => {
  const filters = buildAuditLogSearchFilters("alice")

  assert.deepEqual(filters, [
    { entityId: { contains: "alice", mode: "insensitive" } },
    { actorId: { contains: "alice", mode: "insensitive" } },
    { actorName: { contains: "alice", mode: "insensitive" } },
    { actorEmail: { contains: "alice", mode: "insensitive" } },
    { action: { contains: "alice", mode: "insensitive" } },
    { entityType: { contains: "alice", mode: "insensitive" } },
  ])
})

test("buildAuditLogSearchFilters returns empty when search is blank", () => {
  assert.deepEqual(buildAuditLogSearchFilters("  \n\t "), [])
})
