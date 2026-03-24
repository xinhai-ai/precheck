const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export function normalizeAvatarDomains(domains: string[]): string[] {
  return [...new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean))].filter(
    (domain) => DOMAIN_RE.test(domain),
  )
}

export function isAllowedAvatarUrl(value: string, allowedDomains: string[]): boolean {
  const normalizedValue = value.trim()
  if (!normalizedValue) return false

  let parsed: URL
  try {
    parsed = new URL(normalizedValue)
  } catch {
    return false
  }

  const hostname = parsed.hostname.trim().toLowerCase()
  const normalizedDomains = normalizeAvatarDomains(allowedDomains)

  if (parsed.protocol !== "https:") return false
  if (parsed.port && parsed.port !== "443") return false
  if (parsed.username || parsed.password) return false
  if (!DOMAIN_RE.test(hostname)) return false

  return normalizedDomains.some(
    (allowedDomain) => hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`),
  )
}

export function getSafeAvatarUrl(
  value: string | null | undefined,
  allowedDomains: string[],
): string | undefined {
  const normalizedValue = value?.trim()
  if (!normalizedValue) return undefined

  return isAllowedAvatarUrl(normalizedValue, allowedDomains) ? normalizedValue : undefined
}
