import { createHash } from "crypto"
import type {
  FingerprintComponentPrimitive,
  FingerprintComponents,
  FingerprintComponentValue,
  FingerprintSummary,
} from "@/lib/fingerprint/types"

const MAX_STRING_LENGTH = 512
const MAX_ARRAY_LENGTH = 80
const MAX_JSON_LENGTH = 32 * 1024

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

const BINDING_FIELDS = [
  "browser.languages",
  "browser.platform",
  "browser.timezone",
  "screen.width",
  "screen.height",
  "screen.colorDepth",
  "screen.devicePixelRatio",
  "hardware.hardwareConcurrency",
  "hardware.deviceMemory",
  "hardware.maxTouchPoints",
  "graphics.canvas",
  "graphics.webglVendor",
  "graphics.webglRenderer",
  "fonts.available",
  "storage.localStorage",
  "storage.indexedDB",
  "features.wasm",
  "features.webgpu",
]

function hashLegacyVisitorId(visitorId: string | null | undefined, pepper: string): string | null {
  const normalized = visitorId?.trim()
  if (!normalized) return null

  return createHash("sha256").update(`${normalized}${pepper}`).digest("hex")
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

function getByPath(
  components: FingerprintComponents,
  path: string,
): FingerprintComponentValue | undefined {
  const [group, field] = path.split(".")
  return components[group]?.[field]
}

function setByPath(
  target: FingerprintComponents,
  path: string,
  value: FingerprintComponentValue | undefined,
) {
  if (value === undefined) return
  const [group, field] = path.split(".")
  target[group] = target[group] || {}
  target[group][field] = value
}

function trimToJsonLimit(components: FingerprintComponents): FingerprintComponents {
  if (stableJson(components).length <= MAX_JSON_LENGTH) return components

  const reduced: FingerprintComponents = {}
  for (const path of BINDING_FIELDS) {
    setByPath(reduced, path, getByPath(components, path))
  }
  return reduced
}

export function sanitizeFingerprintComponents(raw: unknown): {
  components: FingerprintComponents
  componentKeys: string[]
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { components: {}, componentKeys: [] }
  }

  const components: FingerprintComponents = {}

  for (const [group, fields] of Object.entries(raw)) {
    const allowedFields = ALLOWED_COMPONENT_FIELDS[group]
    if (!allowedFields || !fields || typeof fields !== "object" || Array.isArray(fields)) continue

    const outputFields: Record<string, FingerprintComponentValue> = {}
    for (const [field, value] of Object.entries(fields).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (!allowedFields.has(field)) continue
      const safeValue = sanitizeValue(value)
      if (safeValue !== undefined) outputFields[field] = safeValue
    }

    if (Object.keys(outputFields).length) {
      components[group] = outputFields
    }
  }

  const limited = trimToJsonLimit(components)
  const componentKeys = Object.entries(limited)
    .flatMap(([group, fields]) => Object.keys(fields).map((field) => `${group}.${field}`))
    .sort((a, b) => a.localeCompare(b))

  return { components: limited, componentKeys }
}

export function buildFingerprintSummary(components: FingerprintComponents): FingerprintSummary {
  const browser = components.browser || {}
  const screen = components.screen || {}
  const graphics = components.graphics || {}
  const hardware = components.hardware || {}

  const width = typeof screen.width === "number" ? screen.width : null
  const height = typeof screen.height === "number" ? screen.height : null
  const ratio = typeof screen.devicePixelRatio === "number" ? screen.devicePixelRatio : null
  const languages = Array.isArray(browser.languages)
    ? browser.languages.filter((item): item is string => typeof item === "string")
    : undefined

  return {
    browser: typeof browser.userAgent === "string" ? browser.userAgent : undefined,
    platform: typeof browser.platform === "string" ? browser.platform : undefined,
    timezone: typeof browser.timezone === "string" ? browser.timezone : undefined,
    languages,
    screen: width && height ? `${width}×${height}${ratio ? ` @${ratio}x` : ""}` : undefined,
    webgl:
      typeof graphics.webglVendor === "string" || typeof graphics.webglRenderer === "string"
        ? `${typeof graphics.webglVendor === "string" ? graphics.webglVendor : "-"} / ${
            typeof graphics.webglRenderer === "string" ? graphics.webglRenderer : "-"
          }`
        : undefined,
    canvasPresent: typeof graphics.canvas === "string" ? graphics.canvas.length > 0 : undefined,
    hardware:
      typeof hardware.hardwareConcurrency === "number" ||
      typeof hardware.deviceMemory === "number" ||
      typeof hardware.maxTouchPoints === "number"
        ? `${typeof hardware.hardwareConcurrency === "number" ? hardware.hardwareConcurrency : "-"} cores / ${
            typeof hardware.deviceMemory === "number" ? hardware.deviceMemory : "-"
          } GB / touch ${typeof hardware.maxTouchPoints === "number" ? hardware.maxTouchPoints : "-"}`
        : undefined,
  }
}

export function buildFingerprintBinding(
  raw: unknown,
  pepper: string,
  legacyVisitorId?: string | null,
): {
  fingerprintHash: string | null
  components: FingerprintComponents
  componentKeys: string[]
  basis: FingerprintComponents
  summary: FingerprintSummary
} {
  const { components, componentKeys } = sanitizeFingerprintComponents(raw)
  const basis: FingerprintComponents = {}
  for (const path of BINDING_FIELDS) {
    setByPath(basis, path, getByPath(components, path))
  }

  const hasBasis = Object.keys(basis).some((group) => Object.keys(basis[group] || {}).length > 0)
  const fingerprintHash = hasBasis
    ? createHash("sha256").update(`${stableJson(basis)}${pepper}`).digest("hex")
    : hashLegacyVisitorId(legacyVisitorId, pepper)

  return {
    fingerprintHash,
    components,
    componentKeys,
    basis,
    summary: buildFingerprintSummary(components),
  }
}

export function flattenFingerprintComponents(components: FingerprintComponents): Map<string, string> {
  const output = new Map<string, string>()
  for (const [group, fields] of Object.entries(components)) {
    for (const [field, value] of Object.entries(fields)) {
      output.set(`${group}.${field}`, stableJson(value))
    }
  }
  return output
}
