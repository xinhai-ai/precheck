import { z } from "zod"
import type {
  FingerprintComponentPrimitive,
  FingerprintComponents,
  FingerprintComponentValue,
  FingerprintPayload,
} from "@/lib/fingerprint/types"

const fingerprintPayloadSchema = z.object({
  fingerprintVisitorId: z.string().trim().min(1).max(256).optional(),
  fingerprintComponents: z.unknown().optional(),
  fingerprintStatus: z.enum(["OK", "COLLECTION_FAILED"]).optional(),
  fingerprintFailureReason: z.string().trim().max(200).optional(),
})

const MAX_STRING_LENGTH = 512
const MAX_ARRAY_LENGTH = 80

const ALLOWED_COMPONENT_FIELDS: Record<string, Set<string>> = {
  browser: new Set([
    "userAgent",
    "languages",
    "language",
    "platform",
    "timezone",
    "cookieEnabled",
    "doNotTrack",
    "vendor",
    "webdriver",
  ]),
  screen: new Set([
    "width",
    "height",
    "availWidth",
    "availHeight",
    "colorDepth",
    "pixelDepth",
    "devicePixelRatio",
    "orientation",
  ]),
  hardware: new Set(["hardwareConcurrency", "deviceMemory", "maxTouchPoints"]),
  graphics: new Set([
    "canvas",
    "webglVendor",
    "webglRenderer",
    "webglVersion",
    "webglShadingLanguageVersion",
    "webglParameters",
  ]),
  media: new Set(["audio", "mediaDevices", "mimeTypes", "plugins"]),
  storage: new Set(["localStorage", "sessionStorage", "indexedDB", "serviceWorker", "cookies"]),
  fonts: new Set(["available", "count"]),
  features: new Set(["wasm", "webgpu", "webrtc", "permissions", "touch", "reducedMotion"]),
  errors: new Set(["items"]),
}

function sanitizePrimitive(value: unknown): FingerprintComponentPrimitive | undefined {
  if (value === null) return null
  if (typeof value === "string") return value.trim().slice(0, MAX_STRING_LENGTH)
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value === "boolean") return value
  return undefined
}

function sanitizeValue(value: unknown): FingerprintComponentValue | undefined {
  const primitive = sanitizePrimitive(value)
  if (primitive !== undefined) return primitive

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizePrimitive(item))
      .filter((item): item is FingerprintComponentPrimitive => item !== undefined)
  }

  if (typeof value === "object" && value) {
    const output: Record<string, FingerprintComponentPrimitive | FingerprintComponentPrimitive[]> =
      {}
    for (const [key, nestedValue] of Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const safeKey = key.trim().slice(0, 80)
      const safeValue = sanitizeValue(nestedValue)
      if (
        safeKey &&
        (typeof safeValue === "string" ||
          typeof safeValue === "number" ||
          typeof safeValue === "boolean" ||
          safeValue === null ||
          (Array.isArray(safeValue) && safeValue.every((item) => typeof item !== "object")))
      ) {
        output[safeKey] = safeValue as FingerprintComponentPrimitive | FingerprintComponentPrimitive[]
      }
    }
    return output
  }

  return undefined
}

function sanitizePayloadComponents(raw: unknown): {
  components: FingerprintComponents | undefined
  hasComponents: boolean
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { components: undefined, hasComponents: false }
  }

  const components: FingerprintComponents = {}
  for (const [group, fields] of Object.entries(raw)) {
    const allowedFields = ALLOWED_COMPONENT_FIELDS[group]
    if (!allowedFields || !fields || typeof fields !== "object" || Array.isArray(fields)) continue

    const safeFields: Record<string, FingerprintComponentValue> = {}
    for (const [field, value] of Object.entries(fields).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!allowedFields.has(field)) continue
      const safeValue = sanitizeValue(value)
      if (safeValue !== undefined) safeFields[field] = safeValue
    }

    if (Object.keys(safeFields).length) {
      components[group] = safeFields
    }
  }

  const hasComponents = Object.keys(components).some(
    (group) => Object.keys(components[group] || {}).length > 0,
  )

  return {
    components: hasComponents ? components : undefined,
    hasComponents,
  }
}

export function parseFingerprintPayload(raw: unknown): FingerprintPayload {
  const parsed = fingerprintPayloadSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: "payload_invalid",
    }
  }

  const status = parsed.data.fingerprintStatus ?? "COLLECTION_FAILED"
  const visitorId = parsed.data.fingerprintVisitorId?.trim()
  const failureReason = parsed.data.fingerprintFailureReason?.trim()
  const { components, hasComponents } = sanitizePayloadComponents(parsed.data.fingerprintComponents)

  if (status === "OK" && !hasComponents && !visitorId) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: failureReason || "fingerprint_components_missing",
    }
  }

  if (status === "COLLECTION_FAILED") {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: failureReason || "collection_failed",
      ...(components ? { fingerprintComponents: components } : {}),
    }
  }

  return {
    fingerprintStatus: "OK",
    fingerprintVisitorId: visitorId,
    fingerprintFailureReason: failureReason,
    ...(components ? { fingerprintComponents: components } : {}),
  }
}
