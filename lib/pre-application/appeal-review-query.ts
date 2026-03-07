import { Prisma, type PreApplicationStatus } from "@prisma/client"

interface BuildLockRejectedPreApplicationQueryInput {
  preApplicationId: string
  status: PreApplicationStatus
  version: number
}

export function buildLockRejectedPreApplicationQuery({
  preApplicationId,
  status,
  version,
}: BuildLockRejectedPreApplicationQueryInput) {
  return Prisma.sql`
    SELECT "id"
    FROM "PreApplication"
    WHERE "id" = ${preApplicationId}
      AND "status" = ${status}::"PreApplicationStatus"
      AND "version" = ${version}
    FOR UPDATE
  `
}
