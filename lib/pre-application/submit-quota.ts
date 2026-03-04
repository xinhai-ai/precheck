import { getRedisClient } from "../redis"

const PREAPP_QUOTA_LUA = `
local globalKey = KEYS[1]
local userKey = KEYS[2]
local globalLimit = tonumber(ARGV[1])
local userLimit = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local globalCurrent = tonumber(redis.call("GET", globalKey) or "0")
if globalCurrent >= globalLimit then
  return "GLOBAL_LIMIT"
end

local userCurrent = tonumber(redis.call("GET", userKey) or "0")
if userCurrent >= userLimit then
  return "USER_LIMIT"
end

local newGlobal = redis.call("INCR", globalKey)
if newGlobal == 1 then
  redis.call("EXPIRE", globalKey, ttlSeconds)
end

local newUser = redis.call("INCR", userKey)
if newUser == 1 then
  redis.call("EXPIRE", userKey, ttlSeconds)
end

return "OK"
`

export type PreApplicationSubmitQuotaConsumeInput = {
  identity: string
  dayKey: string
  ttlSeconds: number
  dailyGlobalLimit: number
  dailyUserLimit: number
}

export type PreApplicationSubmitQuotaSnapshotInput = {
  identity: string
  dayKey: string
  dailyGlobalLimit: number
  dailyUserLimit: number
}

export type PreApplicationSubmitQuotaConsumeResult =
  | { ok: true }
  | {
      ok: false
      reason: "user_limit_exceeded" | "global_limit_exceeded" | "service_unavailable"
    }

export type PreApplicationSubmitQuotaSnapshotResult =
  | {
      ok: true
      userUsedToday: number
      userRemainingToday: number
      globalUsedToday: number
      globalRemainingToday: number
    }
  | {
      ok: false
      reason: "service_unavailable"
    }

export function buildSubmitQuotaKeys(input: {
  dayKey: string
  identity: string
}): { globalKey: string; userKey: string } {
  return {
    globalKey: `preapp:quota:global:${input.dayKey}`,
    userKey: `preapp:quota:user:${input.identity}:${input.dayKey}`,
  }
}

export async function consumePreApplicationSubmitQuota(
  input: PreApplicationSubmitQuotaConsumeInput,
): Promise<PreApplicationSubmitQuotaConsumeResult> {
  const redis = getRedisClient()
  if (!redis) {
    return { ok: false, reason: "service_unavailable" }
  }

  const ttlSeconds = Math.max(1, Math.floor(input.ttlSeconds))
  const { globalKey, userKey } = buildSubmitQuotaKeys({
    dayKey: input.dayKey,
    identity: input.identity,
  })

  try {
    const evalResult = await redis.eval(
      PREAPP_QUOTA_LUA,
      2,
      globalKey,
      userKey,
      String(input.dailyGlobalLimit),
      String(input.dailyUserLimit),
      String(ttlSeconds),
    )

    const result = typeof evalResult === "string" ? evalResult : String(evalResult)

    if (result === "OK") {
      return { ok: true }
    }

    if (result === "GLOBAL_LIMIT") {
      return { ok: false, reason: "global_limit_exceeded" }
    }

    if (result === "USER_LIMIT") {
      return { ok: false, reason: "user_limit_exceeded" }
    }

    return { ok: false, reason: "service_unavailable" }
  } catch (error) {
    console.error("Failed to consume pre-application submit quota:", error)
    return { ok: false, reason: "service_unavailable" }
  }
}

function toCounter(raw: string | null): number {
  if (!raw) return 0
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

export async function getPreApplicationSubmitQuotaSnapshot(
  input: PreApplicationSubmitQuotaSnapshotInput,
): Promise<PreApplicationSubmitQuotaSnapshotResult> {
  const redis = getRedisClient()
  if (!redis) {
    return { ok: false, reason: "service_unavailable" }
  }

  const { globalKey, userKey } = buildSubmitQuotaKeys({
    dayKey: input.dayKey,
    identity: input.identity,
  })

  try {
    const [globalRaw, userRaw] = await redis.mget(globalKey, userKey)
    const globalUsedToday = toCounter(globalRaw)
    const userUsedToday = toCounter(userRaw)

    return {
      ok: true,
      userUsedToday,
      userRemainingToday: Math.max(0, input.dailyUserLimit - userUsedToday),
      globalUsedToday,
      globalRemainingToday: Math.max(0, input.dailyGlobalLimit - globalUsedToday),
    }
  } catch (error) {
    console.error("Failed to load pre-application submit quota snapshot:", error)
    return { ok: false, reason: "service_unavailable" }
  }
}
