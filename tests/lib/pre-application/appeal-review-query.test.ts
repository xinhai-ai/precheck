import test from "node:test"
import assert from "node:assert/strict"
import { PreApplicationStatus } from "@prisma/client"

const { buildLockRejectedPreApplicationQuery } = await import(
  new URL("../../../lib/pre-application/appeal-review-query.ts", import.meta.url).href
)

test("buildLockRejectedPreApplicationQuery casts enum status for PostgreSQL raw query", () => {
  const query = buildLockRejectedPreApplicationQuery({
    preApplicationId: "pre_123",
    status: PreApplicationStatus.REJECTED,
    version: 7,
  })

  assert.deepEqual(query.values, ["pre_123", PreApplicationStatus.REJECTED, 7])
  assert.ok(query.strings.some((segment: string) => segment.includes('::"PreApplicationStatus"')))
})
