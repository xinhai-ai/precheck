"use client"

import { useEffect, useRef, useState } from "react"

interface GeeTestChallengeProps {
  captchaId: string
  onVerify: (payload: Record<string, unknown>) => void
  onError?: () => void
}

declare global {
  interface Window {
    initGeetest4?: (
      config: Record<string, unknown>,
      callback: (captcha: {
        appendTo: (selector: HTMLElement | string) => void
        onSuccess: (handler: () => void) => void
        onError?: (handler: () => void) => void
        getValidate?: () => Record<string, unknown> | null
        destroy?: () => void
      }) => void,
    ) => void
  }
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      if (window.initGeetest4) resolve()
      else existing.addEventListener("load", () => resolve(), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load GeeTest"))
    document.head.appendChild(script)
  })
}

export function GeetestChallenge({ captchaId, onVerify, onError }: GeeTestChallengeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const captchaRef = useRef<{
    destroy?: () => void
  } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadScript("https://static.geetest.com/v4/gt4.js", "geetest-api-script")
      .then(() => {
        if (cancelled || !containerRef.current || !window.initGeetest4) return

        window.initGeetest4(
          { captchaId },
          (captchaObj) => {
            if (cancelled || !containerRef.current) return
            captchaRef.current = captchaObj
            captchaObj.appendTo(containerRef.current)
            captchaObj.onSuccess(() => {
              const payload = captchaObj.getValidate?.()
              if (payload) {
                onVerify(payload)
              } else {
                onError?.()
              }
            })
            captchaObj.onError?.(() => onError?.())
          },
        )
      })
      .catch((error) => {
        console.error(error)
        setLoadError("failed")
        onError?.()
      })

    return () => {
      cancelled = true
      captchaRef.current?.destroy?.()
    }
  }, [captchaId, onVerify, onError])

  if (loadError) {
    return <div className="text-sm text-destructive">Failed to load GeeTest.</div>
  }

  return <div ref={containerRef} className="min-h-[78px]" />
}
