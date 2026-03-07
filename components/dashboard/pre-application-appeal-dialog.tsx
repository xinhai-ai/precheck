"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

interface PreApplicationAppealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preApplicationId: string
  locale: Locale
  dict: Dictionary
  onSubmitted: () => Promise<boolean> | boolean
}

export function PreApplicationAppealDialog({
  open,
  onOpenChange,
  preApplicationId,
  locale,
  dict,
  onSubmitted,
}: PreApplicationAppealDialogProps) {
  const t = dict.preApplication
  const [reason, setReason] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setReason("")
      setConfirmOpen(false)
      setSubmitting(false)
    }
  }, [open])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (submitting) {
      return
    }

    if (!nextOpen) {
      setConfirmOpen(false)
    }

    onOpenChange(nextOpen)
  }

  const handleConfirmOpenChange = (nextOpen: boolean) => {
    if (submitting) {
      return
    }

    setConfirmOpen(nextOpen)
  }

  const handleOpenConfirm = () => {
    if (!reason.trim() || !preApplicationId || submitting) {
      return
    }

    setConfirmOpen(true)
  }

  const handleSubmit = async () => {
    if (!reason.trim() || !preApplicationId) {
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/pre-application/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preApplicationId,
          reason: reason.trim(),
          locale,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        const message =
          resolveApiErrorMessage(data, dict) ??
          ((t as Record<string, unknown>).appealSubmitFailed as string) ??
          "Failed to submit appeal"

        toast.error(message)
        return
      }

      const refreshed = await onSubmitted()
      if (!refreshed) {
        return
      }

      const autoRejected = Boolean((data as { appeal?: { autoRejected?: boolean } })?.appeal?.autoRejected)
      toast.success(
        autoRejected
          ? (((t as Record<string, unknown>).appealAutoRejected as string) ||
              "Appeal was automatically rejected")
          : (((t as Record<string, unknown>).appealSubmitSuccess as string) ||
              "Appeal submitted successfully"),
      )
      setConfirmOpen(false)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : (((t as Record<string, unknown>).appealSubmitFailed as string) ??
              "Failed to submit appeal"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onEscapeKeyDown={(event) => {
          if (submitting) {
            event.preventDefault()
          }
        }}
        onInteractOutside={(event) => {
          if (submitting) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {((t as Record<string, unknown>).appealDialogTitle as string) || "Submit Appeal"}
          </DialogTitle>
          <DialogDescription>
            {((t as Record<string, unknown>).appealDialogDescription as string) ||
              "Explain why you would like this rejected pre-application to be reviewed again."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pre-application-appeal-reason">
              {((t as Record<string, unknown>).appealReasonLabel as string) || "Appeal Reason"}
            </Label>
            <Textarea
              id="pre-application-appeal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                ((t as Record<string, unknown>).appealReasonPlaceholder as string) ||
                "Please explain the specific reason for your appeal..."
              }
              rows={6}
              maxLength={2000}
              className="resize-none"
            />
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button
            onClick={handleOpenConfirm}
            disabled={submitting || !reason.trim()}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {((t as Record<string, unknown>).appealSubmitting as string) || "Submitting..."}
              </>
            ) : (
              ((t as Record<string, unknown>).appealSubmit as string) || "Submit Appeal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {((t as Record<string, unknown>).appealWarningTitle as string) ||
                "Please confirm before appealing"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {((t as Record<string, unknown>).appealConfirmDescription as string) ||
                "Please review these risk reminders once more before submitting."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
            <div className="space-y-2 text-amber-900 dark:text-amber-100">
              <p>
                {((t as Record<string, unknown>).appealWarningDescription as string) ||
                  "An appeal is not a new submission. It is a request to challenge the current rejection result for this pre-application."}
              </p>
              <p>
                {((t as Record<string, unknown>).appealWarningAiRejectedHint as string) ||
                  "If this pre-application was rejected by AI review, submitting an appeal will cause it to be automatically rejected."}
              </p>
              <p>
                {((t as Record<string, unknown>).appealWarningBanHint as string) ||
                  "If your appeal is rejected, your ability to submit another pre-application may be restricted."}
              </p>
              <p>
                {((t as Record<string, unknown>).appealWarningAutoRejectHint as string) ||
                  "Some appeals may be automatically rejected when the current rejection guidance matches an auto-reject rule."}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t.cancel}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {((t as Record<string, unknown>).appealSubmitting as string) || "Submitting..."}
                </>
              ) : (
                ((t as Record<string, unknown>).appealConfirmSubmit as string) ||
                "Confirm appeal submission"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
