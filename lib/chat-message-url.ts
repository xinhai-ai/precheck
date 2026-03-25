const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const DATA_IMAGE_RE = /^data:image\/(?:avif|bmp|gif|jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i
const IPV4_RE = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/i
const IPV6_RE = /^[0-9a-f:.]+$/i

const BLOCKED_HOST_SUFFIXES = [".internal", ".lan", ".local", ".localdomain", ".localhost"]

function isIpLiteral(hostname: string) {
  const normalized = hostname.replace(/^\[/, "").replace(/\]$/, "")
  if (IPV4_RE.test(normalized)) return true
  return normalized.includes(":") && IPV6_RE.test(normalized)
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return true
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true
  if (isIpLiteral(normalized)) return true
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true
  return !DOMAIN_RE.test(normalized)
}

export function getSafeChatImageUrl(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim()
  if (!normalizedValue) return undefined
  return DATA_IMAGE_RE.test(normalizedValue) ? normalizedValue : undefined
}

export function getSafeChatLinkUrl(value: string | null | undefined): string | undefined {
  const normalizedValue = value?.trim()
  if (!normalizedValue) return undefined

  if (normalizedValue.startsWith("/") && !normalizedValue.startsWith("//")) {
    return normalizedValue
  }

  if (normalizedValue.startsWith("#")) {
    return normalizedValue
  }

  let parsed: URL
  try {
    parsed = new URL(normalizedValue)
  } catch {
    return undefined
  }

  if (parsed.protocol !== "https:") return undefined
  if (parsed.port && parsed.port !== "443") return undefined
  if (parsed.username || parsed.password) return undefined
  if (isBlockedHostname(parsed.hostname)) return undefined

  return normalizedValue
}
