"use client"

import { Turnstile } from "@/components/ui/turnstile"

interface TurnstileChallengeProps {
  siteKey: string
  onVerify: (payload: Record<string, unknown>) => void
  onError?: () => void
  onExpire?: () => void
}

export function TurnstileChallenge({ siteKey, onVerify, onError, onExpire }: TurnstileChallengeProps) {
  return (
    <Turnstile
      siteKey={siteKey}
      onVerify={(token) => onVerify({ token })}
      onError={onError}
      onExpire={onExpire}
    />
  )
}
