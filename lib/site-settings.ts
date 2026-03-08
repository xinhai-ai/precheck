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
  linuxdoAutoAdmin: boolean
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
  linuxdoAutoAdmin: boolean
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
  linuxdoAutoAdmin: false,
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
    linuxdoAutoAdmin: record.linuxdoAutoAdmin,
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
      typeof parsed.linuxdoAutoAdmin !== "boolean"
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

  const existing = await db.siteSettings.findUnique({
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
      linuxdoAutoAdmin: true,
    },
  })

  if (existing) {
    return toSiteSettings(existing)
  }

  const created = await db.siteSettings.create({
    data: {
      id: "global",
      ...defaultSettings,
    },
  })

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
    linuxdoAutoAdmin: updates.linuxdoAutoAdmin ?? current.linuxdoAutoAdmin,
  }

  const saved = await db.siteSettings.upsert({
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
      linuxdoAutoAdmin: true,
    },
  })

  const normalized = toSiteSettings(saved)
  await setSiteSettingsCache(normalized)
  return normalized
}
