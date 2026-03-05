export type BanStatusPayload = {
  status: "ACTIVE" | "BANNED"
  banReason: string | null
}

export function buildBanStatusPayload(input: {
  isCurrentlyBanned: boolean
  banReasonInput: string | null
}): BanStatusPayload | null {
  if (input.isCurrentlyBanned) {
    return {
      status: "ACTIVE",
      banReason: null,
    }
  }

  if (input.banReasonInput === null) {
    return null
  }

  const normalizedReason = input.banReasonInput.trim()

  return {
    status: "BANNED",
    banReason: normalizedReason || null,
  }
}
