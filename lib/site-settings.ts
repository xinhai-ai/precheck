import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { siteConfig } from "@/lib/seo"
import { getRedisClient } from "@/lib/redis"

export type SiteSettings = {
  siteName: string
  siteDescription: string
  contactEmail: string
  userRegistration: boolean
  oauthLogin: boolean
  emailNotifications: boolean
  postModeration: boolean
  maintenanceMode: boolean
  adminApplicationEnabled: boolean
  userTicketsEnabled: boolean
  inviteCodeUrlPrefix: string
  analyticsEnabled: boolean
  umamiAnalyticsEnabled: boolean
  linuxdoAutoAdmin: boolean
  newUserAnnouncementEnabled: boolean
  newUserAnnouncementContent: string
  newUserAnnouncementConfirmText: string
  newUserAnnouncementDelaySeconds: number
  newUserAnnouncementVersion: number
  registerQqNumberEmailOnly: boolean
  allowedAvatarDomains: string[]
}

type SiteSettingsRecord = {
  siteName: string
  siteDescription: string
  contactEmail: string
  userRegistration: boolean
  oauthLogin: boolean
  emailNotifications: boolean
  postModeration: boolean
  maintenanceMode: boolean
  adminApplicationEnabled: boolean
  userTicketsEnabled: boolean
  inviteCodeUrlPrefix: string | null
  analyticsEnabled: boolean
  umamiAnalyticsEnabled: boolean
  linuxdoAutoAdmin: boolean
  newUserAnnouncementEnabled: boolean
  newUserAnnouncementContent: string
  newUserAnnouncementConfirmText: string
  newUserAnnouncementDelaySeconds: number
  newUserAnnouncementVersion: number
  registerQqNumberEmailOnly: boolean
  allowedAvatarDomains: unknown
}

const defaultSettings: SiteSettings = {
  siteName: siteConfig.name,
  siteDescription: "A production-ready Next.js starter template",
  contactEmail: "contact@example.com",
  userRegistration: true,
  oauthLogin: true,
  emailNotifications: true,
  postModeration: false,
  maintenanceMode: false,
  adminApplicationEnabled: true,
  userTicketsEnabled: true,
  inviteCodeUrlPrefix: "",
  analyticsEnabled: true,
  umamiAnalyticsEnabled: true,
  linuxdoAutoAdmin: false,
  newUserAnnouncementEnabled: false,
  newUserAnnouncementContent: "",
  newUserAnnouncementConfirmText: "",
  newUserAnnouncementDelaySeconds: 0,
  newUserAnnouncementVersion: 1,
  registerQqNumberEmailOnly: false,
  allowedAvatarDomains: [],
}

const SITE_SETTINGS_CACHE_KEY = "site-settings:global:v1"
const SITE_SETTINGS_CACHE_TTL_SECONDS = (() => {
  const parsed = Number.parseInt(process.env.SITE_SETTINGS_CACHE_TTL_SECONDS || "60", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
})()

function toSiteSettings(record: SiteSettingsRecord): SiteSettings {
  return {
    siteName: record.siteName,
    siteDescription: record.siteDescription,
    contactEmail: record.contactEmail,
    userRegistration: record.userRegistration,
    oauthLogin: record.oauthLogin,
    emailNotifications: record.emailNotifications,
    postModeration: record.postModeration,
    maintenanceMode: record.maintenanceMode,
    adminApplicationEnabled: record.adminApplicationEnabled,
    userTicketsEnabled: record.userTicketsEnabled,
    inviteCodeUrlPrefix: record.inviteCodeUrlPrefix ?? "",
    analyticsEnabled: record.analyticsEnabled,
    umamiAnalyticsEnabled: record.umamiAnalyticsEnabled,
    linuxdoAutoAdmin: record.linuxdoAutoAdmin,
    newUserAnnouncementEnabled: record.newUserAnnouncementEnabled,
    newUserAnnouncementContent: record.newUserAnnouncementContent ?? "",
    newUserAnnouncementConfirmText: record.newUserAnnouncementConfirmText ?? "",
    newUserAnnouncementDelaySeconds: record.newUserAnnouncementDelaySeconds,
    newUserAnnouncementVersion: record.newUserAnnouncementVersion,
    registerQqNumberEmailOnly: record.registerQqNumberEmailOnly ?? false,
    allowedAvatarDomains: Array.isArray(record.allowedAvatarDomains)
      ? record.allowedAvatarDomains.filter((value): value is string => typeof value === "string")
      : [],
  }
}

function parseCachedSiteSettings(raw: string): SiteSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SiteSettings>
    if (!parsed || typeof parsed !== "object") return null

    if (
      typeof parsed.siteName !== "string" ||
      typeof parsed.siteDescription !== "string" ||
      typeof parsed.contactEmail !== "string" ||
      typeof parsed.userRegistration !== "boolean" ||
      typeof parsed.oauthLogin !== "boolean" ||
      typeof parsed.emailNotifications !== "boolean" ||
      typeof parsed.postModeration !== "boolean" ||
      typeof parsed.maintenanceMode !== "boolean" ||
      typeof parsed.adminApplicationEnabled !== "boolean" ||
      typeof parsed.userTicketsEnabled !== "boolean" ||
      typeof parsed.inviteCodeUrlPrefix !== "string" ||
      typeof parsed.analyticsEnabled !== "boolean" ||
      typeof parsed.umamiAnalyticsEnabled !== "boolean" ||
      typeof parsed.linuxdoAutoAdmin !== "boolean" ||
      typeof parsed.newUserAnnouncementEnabled !== "boolean" ||
      typeof parsed.newUserAnnouncementContent !== "string" ||
      typeof parsed.newUserAnnouncementConfirmText !== "string" ||
      typeof parsed.newUserAnnouncementDelaySeconds !== "number" ||
      typeof parsed.newUserAnnouncementVersion !== "number" ||
      typeof parsed.registerQqNumberEmailOnly !== "boolean" ||
      !Array.isArray(parsed.allowedAvatarDomains) ||
      parsed.allowedAvatarDomains.some((value) => typeof value !== "string")
    ) {
      return null
    }

    return parsed as SiteSettings
  } catch {
    return null
  }
}

async function getSiteSettingsFromCache(): Promise<SiteSettings | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const raw = await redis.get(SITE_SETTINGS_CACHE_KEY)
    if (!raw) return null

    const parsed = parseCachedSiteSettings(raw)
    if (parsed) return parsed

    await redis.del(SITE_SETTINGS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to read site settings cache:", error)
  }

  return null
}

async function setSiteSettingsCache(settings: SiteSettings): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.setex(
      SITE_SETTINGS_CACHE_KEY,
      SITE_SETTINGS_CACHE_TTL_SECONDS,
      JSON.stringify(settings),
    )
  } catch (error) {
    console.error("Failed to write site settings cache:", error)
  }
}

export async function invalidateSiteSettingsCache(): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.del(SITE_SETTINGS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to invalidate site settings cache:", error)
  }
}

async function loadSiteSettingsFromDb(): Promise<SiteSettings> {
  if (!db) {
    return defaultSettings
  }

  const existing = (await (db.siteSettings as any).findUnique({
    where: { id: "global" },
    select: {
      siteName: true,
      siteDescription: true,
      contactEmail: true,
      userRegistration: true,
      oauthLogin: true,
      emailNotifications: true,
      postModeration: true,
      maintenanceMode: true,
      adminApplicationEnabled: true,
      userTicketsEnabled: true,
      inviteCodeUrlPrefix: true,
      analyticsEnabled: true,
      umamiAnalyticsEnabled: true,
      linuxdoAutoAdmin: true,
      newUserAnnouncementEnabled: true,
      newUserAnnouncementContent: true,
      newUserAnnouncementConfirmText: true,
      newUserAnnouncementDelaySeconds: true,
      newUserAnnouncementVersion: true,
      registerQqNumberEmailOnly: true,
      allowedAvatarDomains: true,
    },
  })) as SiteSettingsRecord | null

  if (existing) {
    return toSiteSettings(existing)
  }

  const created = (await (db.siteSettings as any).create({
    data: {
      id: "global",
      ...defaultSettings,
    },
  })) as SiteSettingsRecord & Record<string, unknown>

  await writeAuditLog(db, {
    action: "SETTINGS_INIT",
    entityType: "SITE_SETTINGS",
    entityId: "global",
    after: created,
    metadata: { source: "auto-init" },
  })

  return toSiteSettings(created)
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!db) {
    return defaultSettings
  }

  const cached = await getSiteSettingsFromCache()
  if (cached) {
    return cached
  }

  const settings = await loadSiteSettingsFromDb()
  await setSiteSettingsCache(settings)
  return settings
}

export async function updateSiteSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
  if (!db) {
    throw new Error("Database not configured")
  }

  const current = await loadSiteSettingsFromDb()
  const data: SiteSettings = {
    siteName: updates.siteName ?? current.siteName,
    siteDescription: updates.siteDescription ?? current.siteDescription,
    contactEmail: updates.contactEmail ?? current.contactEmail,
    userRegistration: updates.userRegistration ?? current.userRegistration,
    oauthLogin: updates.oauthLogin ?? current.oauthLogin,
    emailNotifications: updates.emailNotifications ?? current.emailNotifications,
    postModeration: updates.postModeration ?? current.postModeration,
    maintenanceMode: updates.maintenanceMode ?? current.maintenanceMode,
    adminApplicationEnabled: updates.adminApplicationEnabled ?? current.adminApplicationEnabled,
    userTicketsEnabled: updates.userTicketsEnabled ?? current.userTicketsEnabled,
    inviteCodeUrlPrefix: updates.inviteCodeUrlPrefix ?? current.inviteCodeUrlPrefix,
    analyticsEnabled: updates.analyticsEnabled ?? current.analyticsEnabled,
    umamiAnalyticsEnabled: updates.umamiAnalyticsEnabled ?? current.umamiAnalyticsEnabled,
    linuxdoAutoAdmin: updates.linuxdoAutoAdmin ?? current.linuxdoAutoAdmin,
    newUserAnnouncementEnabled:
      updates.newUserAnnouncementEnabled ?? current.newUserAnnouncementEnabled,
    newUserAnnouncementContent:
      updates.newUserAnnouncementContent ?? current.newUserAnnouncementContent,
    newUserAnnouncementConfirmText:
      updates.newUserAnnouncementConfirmText ?? current.newUserAnnouncementConfirmText,
    newUserAnnouncementDelaySeconds:
      updates.newUserAnnouncementDelaySeconds ?? current.newUserAnnouncementDelaySeconds,
    newUserAnnouncementVersion:
      updates.newUserAnnouncementVersion ?? current.newUserAnnouncementVersion,
    registerQqNumberEmailOnly:
      updates.registerQqNumberEmailOnly ?? current.registerQqNumberEmailOnly,
    allowedAvatarDomains: updates.allowedAvatarDomains ?? current.allowedAvatarDomains,
  }

  const saved = (await (db.siteSettings as any).upsert({
    where: { id: "global" },
    update: data,
    create: {
      id: "global",
      ...data,
    },
    select: {
      siteName: true,
      siteDescription: true,
      contactEmail: true,
      userRegistration: true,
      oauthLogin: true,
      emailNotifications: true,
      postModeration: true,
      maintenanceMode: true,
      adminApplicationEnabled: true,
      userTicketsEnabled: true,
      inviteCodeUrlPrefix: true,
      analyticsEnabled: true,
      umamiAnalyticsEnabled: true,
      linuxdoAutoAdmin: true,
      newUserAnnouncementEnabled: true,
      newUserAnnouncementContent: true,
      newUserAnnouncementConfirmText: true,
      newUserAnnouncementDelaySeconds: true,
      newUserAnnouncementVersion: true,
      registerQqNumberEmailOnly: true,
      allowedAvatarDomains: true,
    },
  })) as SiteSettingsRecord

  const normalized = toSiteSettings(saved)
  await setSiteSettingsCache(normalized)
  return normalized
}
