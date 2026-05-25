import type { Role } from "@prisma/client"
import { getRedisClient } from "@/lib/redis"

export const DASHBOARD_ONLINE_WINDOW_SECONDS = 75

const ONLINE_USERS_KEY = "dashboard:online:users"
const ONLINE_ROLES_KEY = "dashboard:online:roles"
const ONLINE_KEYS_TTL_SECONDS = DASHBOARD_ONLINE_WINDOW_SECONDS * 4

type OnlinePresenceUser = {
  id: string
  role: Role
}

export type DashboardOnlineSummary = {
  total: number
  admins: number
}

function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN"
}

async function pruneStalePresence(redis: ReturnType<typeof getRedisClient>, nowMs: number) {
  if (!redis) return

  const cutoffMs = nowMs - DASHBOARD_ONLINE_WINDOW_SECONDS * 1000
  const staleUserIds = await redis.zrangebyscore(ONLINE_USERS_KEY, "-inf", cutoffMs)
  const pipeline = redis.multi().zremrangebyscore(ONLINE_USERS_KEY, "-inf", cutoffMs)

  if (staleUserIds.length > 0) {
    pipeline.hdel(ONLINE_ROLES_KEY, ...staleUserIds)
  }

  await pipeline.exec()
}

export async function recordDashboardOnlinePresence(user: OnlinePresenceUser): Promise<boolean> {
  const redis = getRedisClient()
  if (!redis) return false

  try {
    const nowMs = Date.now()
    await redis
      .multi()
      .zadd(ONLINE_USERS_KEY, nowMs, user.id)
      .hset(ONLINE_ROLES_KEY, user.id, user.role)
      .expire(ONLINE_USERS_KEY, ONLINE_KEYS_TTL_SECONDS)
      .expire(ONLINE_ROLES_KEY, ONLINE_KEYS_TTL_SECONDS)
      .exec()
    await pruneStalePresence(redis, nowMs)
    return true
  } catch (error) {
    console.error("Failed to record dashboard online presence:", error)
    return false
  }
}

export async function getDashboardOnlineSummary(): Promise<DashboardOnlineSummary | null> {
  const redis = getRedisClient()
  if (!redis) return null

  try {
    const nowMs = Date.now()
    const cutoffMs = nowMs - DASHBOARD_ONLINE_WINDOW_SECONDS * 1000

    await pruneStalePresence(redis, nowMs)

    const userIds = await redis.zrangebyscore(ONLINE_USERS_KEY, cutoffMs, "+inf")
    if (userIds.length === 0) {
      return { total: 0, admins: 0 }
    }

    const roles = await redis.hmget(ONLINE_ROLES_KEY, ...userIds)
    const admins = roles.filter((role) => isAdminRole(role)).length

    return {
      total: userIds.length,
      admins,
    }
  } catch (error) {
    console.error("Failed to load dashboard online summary:", error)
    return null
  }
}
