import { randomBytes } from "crypto"
import { getRedisClient } from "@/lib/redis"
import { parseFingerprintPayload } from "@/lib/fingerprint/payload"
import type { FingerprintPayload } from "@/lib/fingerprint/types"

const OAUTH_CONTEXT_TTL_SECONDS = 10 * 60
const OAUTH_CONTEXT_KEY_PREFIX = "fingerprint:oauth:"

const memoryStore = new Map<string, { payload: FingerprintPayload; expiresAt: number }>()

function cleanupExpiredMemoryStore() {
  const now = Date.now()
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt <= now) {
      memoryStore.delete(key)
    }
  }
}

function redisKey(token: string) {
  return `${OAUTH_CONTEXT_KEY_PREFIX}${token}`
}

function createToken() {
  return randomBytes(24).toString("base64url")
}

export async function createOAuthFingerprintContext(payload: FingerprintPayload): Promise<string> {
  const token = createToken()
  const safePayload = parseFingerprintPayload(payload)
  const serialized = JSON.stringify(safePayload)

  const redis = getRedisClient()
  if (redis) {
    try {
      await redis.set(redisKey(token), serialized, "EX", OAUTH_CONTEXT_TTL_SECONDS)
      return token
    } catch (error) {
      console.error("[fingerprint] failed to save oauth context in redis:", error)
    }
  }

  cleanupExpiredMemoryStore()
  memoryStore.set(token, {
    payload: safePayload,
    expiresAt: Date.now() + OAUTH_CONTEXT_TTL_SECONDS * 1000,
  })
  return token
}

export async function consumeOAuthFingerprintContext(token: string): Promise<FingerprintPayload | null> {
  const normalizedToken = token.trim()
  if (!normalizedToken) return null

  const redis = getRedisClient()
  if (redis) {
    try {
      const key = redisKey(normalizedToken)
      const raw = await redis.get(key)
      if (raw) {
        await redis.del(key)
        return parseFingerprintPayload(JSON.parse(raw))
      }
    } catch (error) {
      console.error("[fingerprint] failed to consume oauth context from redis:", error)
    }
  }

  cleanupExpiredMemoryStore()
  const inMemory = memoryStore.get(normalizedToken)
  if (!inMemory) return null

  memoryStore.delete(normalizedToken)
  if (inMemory.expiresAt <= Date.now()) {
    return null
  }

  return inMemory.payload
}

