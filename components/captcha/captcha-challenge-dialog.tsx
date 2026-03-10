"use client"

import { Loader2, Shield } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TurnstileChallenge } from "@/components/captcha/turnstile-challenge"
import { HcaptchaChallenge } from "@/components/captcha/hcaptcha-challenge"
import { GeetestChallenge } from "@/components/captcha/geetest-challenge"

export type CaptchaProvider = "turnstile" | "hcaptcha" | "geetest"

interface CaptchaChallengeDialogProps {
  open: boolean
  provider: CaptchaProvider | null
  publicConfig: Record<string, unknown> | null
  onOpenChange: (open: boolean) => void
  onVerify: (payload: Record<string, unknown>) => void | Promise<void>
  loading?: boolean
  error?: string | null
}

export function CaptchaChallengeDialog({
  open,
  provider,
  publicConfig,
  onOpenChange,
  onVerify,
  loading = false,
  error,
}: CaptchaChallengeDialogProps) {
  const renderChallenge = () => {
    if (!provider || !publicConfig) {
      return <div className="text-sm text-muted-foreground">Captcha is not available.</div>
    }

    if (provider === "turnstile") {
      const siteKey = typeof publicConfig.siteKey === "string" ? publicConfig.siteKey : ""
      return <TurnstileChallenge siteKey={siteKey} onVerify={onVerify} />
    }

    if (provider === "hcaptcha") {
      const siteKey = typeof publicConfig.siteKey === "string" ? publicConfig.siteKey : ""
      return <HcaptchaChallenge siteKey={siteKey} onVerify={onVerify} />
    }

    const captchaId = typeof publicConfig.captchaId === "string" ? publicConfig.captchaId : ""
    return <GeetestChallenge captchaId={captchaId} onVerify={onVerify} />
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            完成人机验证
          </DialogTitle>
          <DialogDescription>
            通过验证后将立即继续提交当前预申请。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在提交...
            </div>
          ) : null}
          {renderChallenge()}
          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
