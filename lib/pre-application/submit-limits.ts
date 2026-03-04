import { db } from "@/lib/db"
import { getRedisClient } from "@/lib/redis"
import {
  type PreApplicationSubmitLimits,
  normalizeSubmitLimits,
} from "@/lib/pre-application/submit-limits-utils"

const PREAPP_SUBMIT_LIMITS_CACHE_KEY = "preapp:submit-limits:v1"
const PREAPP_SUBMIT_LIMITS_CACHE_TTL_SECONDS = 60

type SubmitLimitsRecord = {
  preApplicationDailyGlobalLimit: number
  preApplicationDailyUserLimit: number
  preApplicationSubmitStartTime: string
  preApplicationSubmitEndTime: string
}

function parseCachedSubmitLimits(raw: string): PreApplicationSubmitLimits | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PreApplicationSubmitLimits>
    if (!parsed || typeof parsed !== "object") return null

    return normalizeSubmitLimits({
      dailyGlobalLimit: parsed.dailyGlobalLimit,
      dailyUserLimit: parsed.dailyUserLimit,
      submitStartTime: parsed.submitStartTime,
      submitEndTime: parsed.submitEndTime,
    })
  } catch {
    return null
  }
}

async function getSubmitLimitsFromCache(): Promise<PreApplicationSubmitLimits | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const raw = await redis.get(PREAPP_SUBMIT_LIMITS_CACHE_KEY)
    if (!raw) return null

    const parsed = parseCachedSubmitLimits(raw)
    if (parsed) {
      return parsed
    }

    await redis.del(PREAPP_SUBMIT_LIMITS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to read pre-application submit limits cache:", error)
  }

  return null
}

async function setSubmitLimitsCache(limits: PreApplicationSubmitLimits): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.setex(
      PREAPP_SUBMIT_LIMITS_CACHE_KEY,
      PREAPP_SUBMIT_LIMITS_CACHE_TTL_SECONDS,
      JSON.stringify(limits),
    )
  } catch (error) {
    console.error("Failed to write pre-application submit limits cache:", error)
  }
}

export async function invalidateSubmitLimitsCache(): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return

  try {
    await redis.del(PREAPP_SUBMIT_LIMITS_CACHE_KEY)
  } catch (error) {
    console.error("Failed to invalidate pre-application submit limits cache:", error)
  }
}

async function loadSubmitLimitsFromDb(): Promise<PreApplicationSubmitLimits> {
  if (!db) {
    return normalizeSubmitLimits({})
  }

  const settings = await db.siteSettings.findUnique({
    where: { id: "global" },
    select: {
      preApplicationDailyGlobalLimit: true,
      preApplicationDailyUserLimit: true,
      preApplicationSubmitStartTime: true,
      preApplicationSubmitEndTime: true,
    },
  })

  if (!settings) {
    return normalizeSubmitLimits({})
  }

  const record = settings as SubmitLimitsRecord

  return normalizeSubmitLimits({
    dailyGlobalLimit: record.preApplicationDailyGlobalLimit,
    dailyUserLimit: record.preApplicationDailyUserLimit,
    submitStartTime: record.preApplicationSubmitStartTime,
    submitEndTime: record.preApplicationSubmitEndTime,
  })
}

export async function getPreApplicationSubmitLimits(): Promise<PreApplicationSubmitLimits> {
  if (!db) {
    return normalizeSubmitLimits({})
  }

  const cached = await getSubmitLimitsFromCache()
  if (cached) {
    return cached
  }

  const limits = await loadSubmitLimitsFromDb()
  await setSubmitLimitsCache(limits)

  return limits
}
