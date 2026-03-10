import { db } from "@/lib/db"
import { getRedisClient } from "@/lib/redis"

const PREAPP_CAPTCHA_SETTINGS_CACHE_KEY = "preapp:captcha-settings:v1"
const PREAPP_CAPTCHA_SETTINGS_CACHE_TTL_SECONDS = 60

export type PreApplicationCaptchaSettings = {
  preApplicationCaptchaEnabled: boolean
  preApplicationCaptchaProvider: "turnstile" | "hcaptcha" | "geetest" | null
}

const defaultSettings: PreApplicationCaptchaSettings = {
  preApplicationCaptchaEnabled: false,
  preApplicationCaptchaProvider: null,
}

function normalizeCaptchaProvider(
  value: string | null | undefined,
): PreApplicationCaptchaSettings["preApplicationCaptchaProvider"] {
  return value === "turnstile" || value === "hcaptcha" || value === "geetest" ? value : null
}

function parseCachedSettings(raw: string): PreApplicationCaptchaSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PreApplicationCaptchaSettings>
    if (typeof parsed.preApplicationCaptchaEnabled !== "boolean") return null

    return {
      preApplicationCaptchaEnabled: parsed.preApplicationCaptchaEnabled,
      preApplicationCaptchaProvider: normalizeCaptchaProvider(parsed.preApplicationCaptchaProvider),
    }
  } catch {
    return null
  }
}

async function setCaptchaSettingsCache(settings: PreApplicationCaptchaSettings): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.setex(
      PREAPP_CAPTCHA_SETTINGS_CACHE_KEY,
      PREAPP_CAPTCHA_SETTINGS_CACHE_TTL_SECONDS,
      JSON.stringify(settings),
    )
  } catch (error) {
    console.error("Failed to write pre-application captcha settings cache:", error)
  }
}

async function getCaptchaSettingsFromCache(): Promise<PreApplicationCaptchaSettings | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const raw = await redis.get(PREAPP_CAPTCHA_SETTINGS_CACHE_KEY)
    if (!raw) return null

    const parsed = parseCachedSettings(raw)
    if (parsed) return parsed

    await redis.del(PREAPP_CAPTCHA_SETTINGS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to read pre-application captcha settings cache:", error)
  }

  return null
}

export async function invalidatePreApplicationCaptchaSettingsCache(): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.del(PREAPP_CAPTCHA_SETTINGS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to invalidate pre-application captcha settings cache:", error)
  }
}

async function loadCaptchaSettingsFromDb(): Promise<PreApplicationCaptchaSettings> {
  if (!db) return defaultSettings

  const settings = await db.siteSettings.findUnique({
    where: { id: "global" },
    select: {
      preApplicationCaptchaEnabled: true,
      preApplicationCaptchaProvider: true,
    },
  })

  if (!settings) return defaultSettings

  return {
    preApplicationCaptchaEnabled: settings.preApplicationCaptchaEnabled ?? false,
    preApplicationCaptchaProvider: normalizeCaptchaProvider(settings.preApplicationCaptchaProvider),
  }
}

export async function getPreApplicationCaptchaSettings(): Promise<PreApplicationCaptchaSettings> {
  const cached = await getCaptchaSettingsFromCache()
  if (cached) return cached

  const settings = await loadCaptchaSettingsFromDb()
  await setCaptchaSettingsCache(settings)
  return settings
}
