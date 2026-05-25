import { createHash } from "node:crypto"

export type ReferrerCategory = "search" | "social" | "community" | "docs" | "direct" | "unknown"

export type PrimarySourceType = "utm" | "invite" | "oauth" | "pre_application" | "referer" | "direct" | "unknown"

export type TrafficAttributionInput = {
  requestUrl: string
  referer?: string | null
}

export type TrafficAttribution = {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  referrerHost: string | null
  referrerOrigin: string | null
  referrerCategory: ReferrerCategory
  referrerUrlHash: string | null
  referrerPathHash: string | null
  landingPath: string
}

export type SourceResolutionInput = {
  utmSource?: string | null
  inviteCode?: string | null
  oauthProvider?: string | null
  preApplicationSource?: string | null
  referrerHost?: string | null
}

export type PrimarySource = {
  type: PrimarySourceType
  name: string
}

function cleanValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function parseUrl(value: string | null | undefined) {
  const cleaned = cleanValue(value)
  if (!cleaned) return null

  try {
    return new URL(cleaned)
  } catch {
    return null
  }
}

export function categorizeReferrerHost(host: string | null | undefined): ReferrerCategory {
  const normalized = cleanValue(host)?.toLowerCase()
  if (!normalized) return "direct"

  if (
    normalized.includes("google.") ||
    normalized.includes("bing.com") ||
    normalized.includes("baidu.com") ||
    normalized.includes("duckduckgo.com")
  ) {
    return "search"
  }

  if (
    normalized.includes("x.com") ||
    normalized.includes("twitter.com") ||
    normalized.includes("facebook.com") ||
    normalized.includes("instagram.com") ||
    normalized.includes("xiaohongshu.com") ||
    normalized.includes("douyin.com") ||
    normalized.includes("bilibili.com")
  ) {
    return "social"
  }

  if (
    normalized.includes("linux.do") ||
    normalized.includes("linux.do.cn") ||
    normalized.includes("v2ex.com") ||
    normalized.includes("tieba.baidu.com")
  ) {
    return "community"
  }

  if (normalized.includes("docs.") || normalized.includes("readthedocs") || normalized.includes("gitbook")) {
    return "docs"
  }

  return "unknown"
}

export async function parseTrafficAttribution(input: TrafficAttributionInput): Promise<TrafficAttribution> {
  const requestUrl = parseUrl(input.requestUrl)
  const refererUrl = parseUrl(input.referer)

  const referrerHost = refererUrl?.hostname || null
  const referrerOrigin = refererUrl?.origin || null
  const referrerPath = refererUrl ? `${refererUrl.pathname}${refererUrl.search}` : null

  return {
    utmSource: cleanValue(requestUrl?.searchParams.get("utm_source")),
    utmMedium: cleanValue(requestUrl?.searchParams.get("utm_medium")),
    utmCampaign: cleanValue(requestUrl?.searchParams.get("utm_campaign")),
    referrerHost,
    referrerOrigin,
    referrerCategory: categorizeReferrerHost(referrerHost),
    referrerUrlHash: input.referer ? sha256(input.referer) : null,
    referrerPathHash: referrerPath ? sha256(referrerPath) : null,
    landingPath: requestUrl?.pathname || "/",
  }
}

export function resolvePrimarySource(input: SourceResolutionInput): PrimarySource {
  const utmSource = cleanValue(input.utmSource)
  if (utmSource) return { type: "utm", name: utmSource }

  const inviteCode = cleanValue(input.inviteCode)
  if (inviteCode) return { type: "invite", name: inviteCode }

  const oauthProvider = cleanValue(input.oauthProvider)
  if (oauthProvider) return { type: "oauth", name: oauthProvider }

  const preApplicationSource = cleanValue(input.preApplicationSource)
  if (preApplicationSource) return { type: "pre_application", name: preApplicationSource }

  const referrerHost = cleanValue(input.referrerHost)
  if (referrerHost) return { type: "referer", name: referrerHost }

  return { type: "direct", name: "Direct" }
}

export function maskEmail(email: string | null | undefined) {
  const value = cleanValue(email)
  if (!value) return ""
  const [localPart, domain] = value.split("@")
  if (!domain) return maskHash(value)
  if (localPart.length <= 1) return `${localPart}***@${domain}`
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`
}

export function maskIp(ip: string | null | undefined) {
  const value = cleanValue(ip)
  if (!value) return ""

  if (value.includes(".")) {
    const parts = value.split(".")
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.*`
  }

  if (value.includes(":")) {
    const parts = value.split(":").filter(Boolean)
    return `${parts.slice(0, 2).join(":")}:****`
  }

  return maskHash(value)
}

export function maskHash(hash: string | null | undefined) {
  const value = cleanValue(hash)
  if (!value) return ""
  if (value.length <= 12) return `${value.slice(0, 4)}…${value.slice(-2)}`
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}
