import type { FingerprintComponents, FingerprintSimilaritySignals } from "@/lib/fingerprint/types"

const FIELD_WEIGHTS = new Map<string, number>([
  ["graphics.webglRenderer", 18],
  ["graphics.canvas", 18],
  ["graphics.webglVendor", 12],
  ["browser.timezone", 8],
  ["browser.languages", 8],
  ["fonts.available", 8],
  ["hardware.hardwareConcurrency", 6],
  ["hardware.deviceMemory", 6],
  ["hardware.maxTouchPoints", 4],
  ["screen.width", 4],
  ["screen.height", 4],
  ["screen.colorDepth", 4],
  ["screen.devicePixelRatio", 4],
  ["storage.localStorage", 3],
  ["storage.indexedDB", 3],
  ["features.wasm", 3],
  ["features.webgpu", 3],
])

const STRONG_FIELDS = new Set(["graphics.webglRenderer", "graphics.canvas", "graphics.webglVendor"])

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`
  }

  return JSON.stringify(value)
}

function flattenComponents(components: FingerprintComponents): Map<string, string> {
  const output = new Map<string, string>()
  for (const [group, fields] of Object.entries(components)) {
    for (const [field, value] of Object.entries(fields)) {
      output.set(`${group}.${field}`, stableJson(value))
    }
  }
  return output
}

export function compareFingerprintComponents(
  current: FingerprintComponents,
  candidate: FingerprintComponents,
): { score: number; signals: FingerprintSimilaritySignals } {
  const currentFlat = flattenComponents(current)
  const candidateFlat = flattenComponents(candidate)
  const keys = Array.from(new Set([...currentFlat.keys(), ...candidateFlat.keys()])).sort((a, b) =>
    a.localeCompare(b),
  )

  let totalWeight = 0
  let matchedWeight = 0
  const matched: string[] = []
  const different: string[] = []
  const strong: string[] = []

  for (const key of keys) {
    const weight = FIELD_WEIGHTS.get(key) || 1
    const currentValue = currentFlat.get(key)
    const candidateValue = candidateFlat.get(key)
    if (currentValue === undefined || candidateValue === undefined) continue

    totalWeight += weight
    if (currentValue === candidateValue) {
      matchedWeight += weight
      matched.push(key)
      if (STRONG_FIELDS.has(key)) strong.push(key)
    } else {
      different.push(key)
    }
  }

  return {
    score: totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0,
    signals: { matched, different, strong },
  }
}

export function selectBestFingerprintSimilarity(
  current: FingerprintComponents,
  candidates: Array<{
    id: string
    fingerprintHash: string | null
    fingerprintComponents: FingerprintComponents | null
  }>,
): { score: number; signals: FingerprintSimilaritySignals } {
  let best = {
    score: 0,
    signals: { matched: [], different: [], strong: [] } as FingerprintSimilaritySignals,
  }

  for (const candidate of candidates) {
    if (!candidate.fingerprintComponents) continue
    const result = compareFingerprintComponents(current, candidate.fingerprintComponents)
    if (result.score > best.score) {
      best = {
        score: result.score,
        signals: {
          ...result.signals,
          comparedEventId: candidate.id,
          comparedFingerprintHash: candidate.fingerprintHash,
        },
      }
    }
  }

  return best
}
