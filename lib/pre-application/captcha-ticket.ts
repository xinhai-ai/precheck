import { randomBytes } from "node:crypto"
import type { CaptchaProvider } from "@/lib/captcha/config"
import { getRedisClient } from "@/lib/redis"

const PRE_APPLICATION_CAPTCHA_TICKET_KEY_PREFIX = "preapp:captcha-ticket:"
export const PRE_APPLICATION_CAPTCHA_TICKET_TTL_SECONDS = 60

type CaptchaTicketRecord = {
  userId: string
  provider: CaptchaProvider
  issuedAt: number
}

function redisKey(ticket: string) {
  return `${PRE_APPLICATION_CAPTCHA_TICKET_KEY_PREFIX}${ticket}`
}

export async function issuePreApplicationCaptchaTicket(input: {
  userId: string
  provider: CaptchaProvider
}): Promise<string | null> {
  const redis = getRedisClient()
  if (!redis) return null

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticket = randomBytes(24).toString("hex")
    const payload: CaptchaTicketRecord = {
      userId: input.userId,
      provider: input.provider,
      issuedAt: Date.now(),
    }

    try {
      const setResult = await redis.set(
        redisKey(ticket),
        JSON.stringify(payload),
        "EX",
        PRE_APPLICATION_CAPTCHA_TICKET_TTL_SECONDS,
        "NX",
      )
      if (setResult === "OK") {
        return ticket
      }
    } catch (error) {
      console.error("Failed to issue pre-application captcha ticket:", error)
      return null
    }
  }

  return null
}

export type ConsumePreApplicationCaptchaTicketResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "service_unavailable" }

export async function consumePreApplicationCaptchaTicket(input: {
  ticket: string
  userId: string
  provider: CaptchaProvider
}): Promise<ConsumePreApplicationCaptchaTicketResult> {
  const redis = getRedisClient()
  if (!redis) {
    return { ok: false, reason: "service_unavailable" }
  }

  const ticket = input.ticket.trim()
  if (!ticket) {
    return { ok: false, reason: "invalid" }
  }

  try {
    const raw = await redis.eval(
      "local value = redis.call('GET', KEYS[1]); if value then redis.call('DEL', KEYS[1]); end; return value",
      1,
      redisKey(ticket),
    )

    if (typeof raw !== "string" || !raw) {
      return { ok: false, reason: "invalid" }
    }

    const parsed = JSON.parse(raw) as Partial<CaptchaTicketRecord>
    if (parsed.userId !== input.userId || parsed.provider !== input.provider) {
      return { ok: false, reason: "invalid" }
    }

    return { ok: true }
  } catch (error) {
    console.error("Failed to consume pre-application captcha ticket:", error)
    return { ok: false, reason: "service_unavailable" }
  }
}
