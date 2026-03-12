"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { startRegistration } from "@simplewebauthn/browser"
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/admin/confirm-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

type PasskeyItem = {
  id: string
  credentialIdSuffix: string
  deviceType: string
  backedUp: boolean
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
}

interface PasskeySettingsCardProps {
  locale: Locale
  dict: Dictionary
}

function isPasskeySupported() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials
}

export function PasskeySettingsCard({ locale, dict }: PasskeySettingsCardProps) {
  const t = dict.dashboard
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  )

  const loadPasskeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/dashboard/passkeys")
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          resolveApiErrorMessage(data, dict) ||
            t.passkeyLoadFailed ||
            "Failed to load passkeys",
        )
      }
      setPasskeys(Array.isArray(data?.passkeys) ? data.passkeys : [])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.passkeyLoadFailed || "Failed to load passkeys"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [dict, t.passkeyLoadFailed])

  useEffect(() => {
    loadPasskeys()
  }, [loadPasskeys])

  const handleBindPasskey = async () => {
    if (!isPasskeySupported()) {
      toast.error(t.passkeyUnsupported || "This browser does not support passkeys")
      return
    }

    setBinding(true)
    try {
      const optionsRes = await fetch("/api/auth/passkey/register/options", {
        method: "POST",
      })
      const optionsPayload = await optionsRes.json().catch(() => null)
      if (!optionsRes.ok) {
        throw new Error(
          resolveApiErrorMessage(optionsPayload, dict) ||
            t.passkeyRegisterFailed ||
            "Failed to create passkey",
        )
      }

      const credential = await startRegistration({
        optionsJSON: optionsPayload.options,
      })

      const verifyRes = await fetch("/api/auth/passkey/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const verifyPayload = await verifyRes.json().catch(() => null)
      if (!verifyRes.ok) {
        throw new Error(
          resolveApiErrorMessage(verifyPayload, dict) ||
            t.passkeyRegisterFailed ||
            "Failed to create passkey",
        )
      }

      toast.success(t.passkeyRegisterSuccess || "Passkey created")
      await loadPasskeys()
    } catch (error) {
      const message =
        error instanceof Error && error.name === "NotAllowedError"
          ? t.passkeyCancelled || t.passkeyRegisterFailed || "Passkey creation cancelled"
          : error instanceof Error
            ? error.message
            : t.passkeyRegisterFailed || "Failed to create passkey"
      toast.error(message)
    } finally {
      setBinding(false)
    }
  }

  const handleDeletePasskey = async () => {
    if (!deleteId) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/dashboard/passkeys/${deleteId}`, {
        method: "DELETE",
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          resolveApiErrorMessage(payload, dict) ||
            t.passkeyDeleteFailed ||
            "Failed to delete passkey",
        )
      }

      toast.success(t.passkeyDeleteSuccess || "Passkey removed")
      setDeleteId(null)
      await loadPasskeys()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.passkeyDeleteFailed || "Failed to delete passkey"
      toast.error(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t.passkeyTitle || "Passkeys"}
        </CardTitle>
        <CardDescription>
          {t.passkeyDesc || "Bind a passkey to sign in without entering your password next time."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t.passkeyListHint ||
              "Passkeys already linked to this account can be used for passwordless sign-in."}
          </p>
          <Button onClick={handleBindPasskey} disabled={binding || loading}>
            {binding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.passkeyRegistering || t.submitting}
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                {t.passkeyAdd || "Add passkey"}
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t.passkeyLoading || "Loading passkeys..."}</span>
          </div>
        ) : passkeys.length === 0 ? (
          <Alert>
            <AlertDescription>
              {t.passkeyEmpty || "No passkeys bound yet. Add one on a trusted device."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {(t.passkeyLabelPrefix || "Passkey") + ` · ${passkey.credentialIdSuffix}`}
                    </span>
                    <Badge variant="secondary">
                      {passkey.deviceType === "multiDevice"
                        ? t.passkeyTypeMultiDevice || "Multi-device"
                        : t.passkeyTypeSingleDevice || "Single-device"}
                    </Badge>
                    {passkey.backedUp ? (
                      <Badge variant="outline">{t.passkeyBackedUp || "Backed up"}</Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>
                      {(t.passkeyCreatedAt || "Created") +
                        `: ${formatter.format(new Date(passkey.createdAt))}`}
                    </span>
                    <span>
                      {(t.passkeyLastUsedAt || "Last used") +
                        `: ${
                          passkey.lastUsedAt
                            ? formatter.format(new Date(passkey.lastUsedAt))
                            : t.passkeyNeverUsed || "Never"
                        }`}
                    </span>
                    <span>
                      {(t.passkeyTransports || "Transports") +
                        `: ${passkey.transports.length > 0 ? passkey.transports.join(", ") : "-"}`}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteId(passkey.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t.passkeyDelete || "Remove"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null)
          }
        }}
        title={t.passkeyDeleteTitle || "Remove passkey?"}
        description={
          t.passkeyDeleteDesc ||
          "This passkey will no longer be able to sign in to your account."
        }
        confirmLabel={t.passkeyDeleteConfirm || t.confirmDelete || "Remove"}
        cancelLabel={t.cancel || "Cancel"}
        onConfirm={handleDeletePasskey}
        confirming={deleting}
        destructive
      />
    </Card>
  )
}
