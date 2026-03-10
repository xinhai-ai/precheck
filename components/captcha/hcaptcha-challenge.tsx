"use client"

import { useEffect, useRef, useState } from "react"

interface HCaptchaChallengeProps {
  siteKey: string
  onVerify: (payload: Record<string, unknown>) => void
  onError?: () => void
  onExpire?: () => void
}

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string | number
      reset?: (widgetId?: string | number) => void
      remove?: (widgetId?: string | number) => void
    }
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      if (window.hcaptcha) resolve()
      else existing.addEventListener("load", () => resolve(), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load hCaptcha"))
    document.head.appendChild(script)
  })
}

export function HcaptchaChallenge({ siteKey, onVerify, onError, onExpire }: HCaptchaChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadScript("https://js.hcaptcha.com/1/api.js?render=explicit", "hcaptcha-api-script")
      .then(() => {
        if (cancelled || !containerRef.current || !window.hcaptcha) return
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => onVerify({ token }),
          "error-callback": () => onError?.(),
          "expired-callback": () => onExpire?.(),
        })
      })
      .catch((error) => {
        console.error(error)
        setLoadError("failed")
        onError?.()
      })

    return () => {
      cancelled = true
      if (window.hcaptcha?.remove && widgetIdRef.current !== null) {
        window.hcaptcha.remove(widgetIdRef.current)
      }
    }
  }, [siteKey, onVerify, onError, onExpire])

  if (loadError) {
    return <div className="text-sm text-destructive">Failed to load hCaptcha.</div>
  }

  return <div ref={containerRef} className="min-h-[78px]" />
}
