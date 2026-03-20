import { isIP } from "node:net"
import type { FingerprintBrowserFamily } from "@/lib/fingerprint/types"

export function normalizeBrowserFamily(
  userAgent: string | null | undefined,
): FingerprintBrowserFamily {
  const ua = userAgent?.trim().toLowerCase() || ""
  if (!ua) return "OTHER"

  if (ua.includes("edgios") || ua.includes("edg/")) return "EDGE"
  if (ua.includes("crios") || ua.includes("chrome")) return "CHROME"
  if (ua.includes("fxios") || ua.includes("firefox")) return "FIREFOX"
  if (ua.includes("safari")) return "SAFARI"

  return "OTHER"
}

export function buildNetworkKey(ip: string | null | undefined): string | null {
  const normalized = ip?.trim()
  if (!normalized) return null

  const family = isIP(normalized)

  if (family === 4) {
    const [a, b, c] = normalized.split(".")
    return `${a}.${b}.${c}.0/24`
  }

  if (family === 6) {
    const segments = normalized.split(":").slice(0, 4)
    if (!segments.length) return null
    return `${segments.join(":")}::/64`
  }

  return null
}
