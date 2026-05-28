"use client"

import { useState } from "react"
import { startAuthentication } from "@simplewebauthn/browser"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

interface PasskeyLoginButtonProps {
  locale: Locale
  dict: Dictionary
  disabled?: boolean
}

function isPasskeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials
}

export function PasskeyLoginButton({ locale, dict, disabled = false }: PasskeyLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const t = dict.auth.login

  const handlePasskeyLogin = async () => {
    if (!isPasskeySupported()) {
      toast.error(t.passkeyUnsupported || "This browser does not support passkeys")
      return
    }

    setIsLoading(true)
    try {
      const optionsRes = await fetch("/api/auth/passkey/authenticate/options", {
        method: "POST",
      })
      const optionsPayload = await optionsRes.json().catch(() => null)
      if (!optionsRes.ok) {
        throw new Error(
          resolveApiErrorMessage(optionsPayload, dict) ||
            t.passkeyLoginFailed ||
            "Passkey login failed",
        )
      }

      const credential = await startAuthentication({
        optionsJSON: optionsPayload.options,
      })

      const verifyRes = await fetch("/api/auth/passkey/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const verifyPayload = await verifyRes.json().catch(() => null)
      if (!verifyRes.ok) {
        throw new Error(
          resolveApiErrorMessage(verifyPayload, dict) ||
            t.passkeyLoginFailed ||
            "Passkey login failed",
        )
      }

      toast.success(t.passkeyLoginSuccess || t.success)
      window.location.href = `/${locale}/dashboard`
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? t.passkeyCancelled || t.passkeyLoginFailed || "Passkey login cancelled"
          : error instanceof Error
            ? error.message
            : t.passkeyLoginFailed || "Passkey login failed"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handlePasskeyLogin}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.passkeyLoggingIn || t.submitting}
        </>
      ) : (
        <>
          <KeyRound className="h-4 w-4" />
          {t.passkeyLogin || "Use passkey"}
        </>
      )}
    </Button>
  )
}
