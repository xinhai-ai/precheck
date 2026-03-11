"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/lib/i18n/config"

const ANNOUNCEMENT_STORAGE_KEY = "user-announcement-ack"

type DashboardAnnouncement = {
  enabled: boolean
  content: string
  confirmText: string
  delaySeconds: number
  version: number
}

interface NewUserAnnouncementGateProps {
  locale: Locale
  user: { role: string }
  announcement: DashboardAnnouncement
}

type AccessState = "checking" | "allowed" | "blocked"

export function NewUserAnnouncementGate({
  locale,
  user,
  announcement,
}: NewUserAnnouncementGateProps) {
  const [accessState, setAccessState] = useState<AccessState>("checking")
  const [countdown, setCountdown] = useState(0)
  const [inputValue, setInputValue] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const isChinese = locale.toLowerCase().startsWith("zh")
  const copy = isChinese
    ? {
        title: "请先阅读并确认公告",
        description: "完成确认后才可以继续使用后台。",
        prompt: "请输入：",
        inputPlaceholder: "请完整输入确认口令",
        submit: "确认并继续",
        waiting: "请等待",
        required: "请输入确认口令",
        mismatch: "确认口令不正确",
        storageError: "写入浏览器确认记录失败，请检查浏览器隐私设置后重试。",
      }
    : {
        title: "Please read and confirm the announcement",
        description: "You must confirm it before using the dashboard.",
        prompt: "Please type:",
        inputPlaceholder: "Enter the full confirmation text",
        submit: "Confirm and continue",
        waiting: "Please wait",
        required: "Please enter the confirmation text",
        mismatch: "The confirmation text does not match",
        storageError:
          "Failed to store the confirmation in this browser. Check browser privacy settings and try again.",
      }

  useEffect(() => {
    if (user.role !== "USER") {
      setAccessState("allowed")
      return
    }

    if (!announcement.enabled || !announcement.content.trim() || !announcement.confirmText.trim()) {
      setAccessState("allowed")
      return
    }

    try {
      const raw = localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { version?: number }
        if (parsed.version === announcement.version) {
          setAccessState("allowed")
          return
        }
      }
    } catch {
      localStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY)
    }

    setInputValue("")
    setError("")
    setCountdown(Math.max(0, announcement.delaySeconds))
    setAccessState("blocked")
  }, [announcement, user.role])

  useEffect(() => {
    if (accessState !== "blocked" || countdown <= 0) {
      return
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [accessState, countdown])

  const isConfirmTextMatched = inputValue === announcement.confirmText
  const shouldDisableSubmit = countdown > 0 || !isConfirmTextMatched || saving
  const showMismatch = inputValue.length > 0 && countdown === 0 && !isConfirmTextMatched

  const handleConfirm = () => {
    if (countdown > 0) {
      return
    }

    if (!inputValue.trim()) {
      setError(copy.required)
      return
    }

    if (inputValue !== announcement.confirmText) {
      setError(copy.mismatch)
      return
    }

    setSaving(true)
    setError("")

    try {
      localStorage.setItem(
        ANNOUNCEMENT_STORAGE_KEY,
        JSON.stringify({
          version: announcement.version,
          confirmedAt: new Date().toISOString(),
        }),
      )
      setAccessState("allowed")
    } catch {
      setError(copy.storageError)
    } finally {
      setSaving(false)
    }
  }

  if (accessState === "allowed") {
    return null
  }

  if (accessState === "checking") {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-[40vh] overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">
            {announcement.content}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {copy.prompt}{" "}
              <span className="font-mono font-medium">{announcement.confirmText}</span>
            </p>
            <Input
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value)
                setError("")
              }}
              placeholder={copy.inputPlaceholder}
              autoFocus
            />
            {showMismatch ? <p className="text-sm text-destructive">{copy.mismatch}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleConfirm} disabled={shouldDisableSubmit}>
            {countdown > 0 ? `${copy.waiting} ${countdown}s` : copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
