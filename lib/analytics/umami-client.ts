"use client"

type UmamiScalar = string | number | boolean
type UmamiPayload = Record<string, UmamiScalar | null | undefined>

type UmamiTracker = {
  track?: (eventName: string, data?: Record<string, UmamiScalar>) => void
  identify?: (uniqueId: string, data?: Record<string, UmamiScalar>) => void
}

declare global {
  interface Window {
    umami?: UmamiTracker
  }
}

const GUEST_ID_STORAGE_KEY = "umami_guest_id"

function cleanPayload(payload: UmamiPayload = {}) {
  const entries = Object.entries(payload).filter(
    (entry): entry is [string, UmamiScalar] => entry[1] !== null && entry[1] !== undefined,
  )
  return Object.fromEntries(entries)
}

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`
  }

  return `guest_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function getOrCreateUmamiGuestId() {
  if (typeof window === "undefined") return null

  try {
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY)
    if (existing) return existing

    const guestId = createGuestId()
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId)
    return guestId
  } catch {
    return createGuestId()
  }
}

export function trackUmamiEvent(eventName: string, payload: UmamiPayload = {}) {
  if (typeof window === "undefined") return

  window.umami?.track?.(eventName, cleanPayload(payload))
}

export function identifyUmamiVisitor(visitorId: string, payload: UmamiPayload = {}) {
  if (typeof window === "undefined") return

  window.umami?.identify?.(visitorId, cleanPayload(payload))
}
