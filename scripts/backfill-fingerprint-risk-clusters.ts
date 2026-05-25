import path from "node:path"
import { fileURLToPath } from "node:url"
import { Prisma, PrismaClient } from "@prisma/client"
import { assignFingerprintRiskCluster } from "@/lib/risk-control/fingerprint-cluster"

export type BackfillFingerprintRiskClustersResult = {
  processed: number
  assigned: number
  skipped: number
  failed: number
  legacyWithoutComponents: number
}

const DEFAULT_BATCH_SIZE = 100

function parseBatchSize(value: string | undefined): number {
  const parsed = Number.parseInt(value || "", 10)

  if (Number.isNaN(parsed) || parsed < 1) {
    return DEFAULT_BATCH_SIZE
  }

  return Math.min(parsed, 1000)
}

function buildBackfillWhere(failedEventIds: string[]): Record<string, unknown> {
  return {
    ...(failedEventIds.length ? { id: { notIn: failedEventIds } } : {}),
    riskClusterMembers: { none: {} },
    OR: [{ fingerprintComponents: { not: Prisma.DbNull } }, { fingerprintHash: { not: null } }],
  }
}

export async function backfillFingerprintRiskClusters(input?: {
  db?: PrismaClient
  batchSize?: number
}): Promise<BackfillFingerprintRiskClustersResult> {
  const prisma = (input?.db ?? new PrismaClient()) as any
  const ownsConnection = !input?.db
  const batchSize =
    input?.batchSize ?? parseBatchSize(process.env.FINGERPRINT_CLUSTER_BACKFILL_BATCH_SIZE)
  const failedEventIds: string[] = []
  const result: BackfillFingerprintRiskClustersResult = {
    processed: 0,
    assigned: 0,
    skipped: 0,
    failed: 0,
    legacyWithoutComponents: 0,
  }

  try {
    while (true) {
      const events = await prisma.fingerprintEvent.findMany({
        where: buildBackfillWhere(failedEventIds),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: batchSize,
        select: {
          id: true,
          fingerprintComponents: true,
          fingerprintHash: true,
        },
      })

      if (!events.length) {
        break
      }

      for (const event of events) {
        result.processed += 1

        if (!event.fingerprintComponents && event.fingerprintHash) {
          result.legacyWithoutComponents += 1
        }

        try {
          const clusterId = await assignFingerprintRiskCluster({
            db: prisma,
            eventId: event.id,
          })

          if (clusterId) {
            result.assigned += 1
          } else {
            result.skipped += 1
          }
        } catch (error) {
          failedEventIds.push(event.id)
          result.failed += 1
          console.error("Failed to backfill fingerprint event:", event.id, error)
        }
      }

      if (events.length < batchSize) {
        break
      }
    }

    return result
  } finally {
    if (ownsConnection) {
      await prisma.$disconnect()
    }
  }
}

function isInvokedAsScript(): boolean {
  if (!process.argv[1]) {
    return false
  }

  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
}

if (isInvokedAsScript()) {
  backfillFingerprintRiskClusters()
    .then((result) => {
      console.log("Fingerprint risk cluster backfill finished:", result)
    })
    .catch((error) => {
      console.error("Fingerprint risk cluster backfill failed:", error)
      process.exitCode = 1
    })
}
