"use client"

import { useEffect, useState } from "react"
import { Loader2, MessageCircle } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { resolveApiErrorMessage } from "@/lib/api/error-message"
import type { Dictionary } from "@/lib/i18n/get-dictionary"

interface PreApplicationAppealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preApplicationId: string
  dict: Dictionary
  onSubmitted: () => Promise<boolean> | boolean
}

export function PreApplicationAppealDialog({
  open,
  onOpenChange,
  preApplicationId,
  dict,
  onSubmitted,
}: PreApplicationAppealDialogProps) {
  const t = dict.preApplication
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setReason("")
      setSubmitting(false)
    }
  }, [open])

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (submitting) {
      return
    }

    onOpenChange(nextOpen)
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

      toast.success(
        ((t as Record<string, unknown>).appealSubmitSuccess as string) ??
          "Appeal submitted successfully",
      )
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

        <div className="space-y-2 py-2">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()} className="gap-2">
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
    </Dialog>
  )
}
