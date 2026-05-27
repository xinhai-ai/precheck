"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  getOrCreateUmamiGuestId,
  identifyUmamiVisitor,
  trackUmamiEvent,
} from "@/lib/analytics/umami-client"
import type { Locale } from "@/lib/i18n/config"

type UmamiAnalyticsBridgeProps = {
  locale: Locale
  visitorId: string | null
  authState: "guest" | "member"
  roleBucket: string
  accountAgeBucket: string
}

export function UmamiAnalyticsBridge({
  locale,
  visitorId,
  authState,
  roleBucket,
  accountAgeBucket,
}: UmamiAnalyticsBridgeProps) {
  const pathname = usePathname()

  useEffect(() => {
    const resolvedVisitorId = visitorId || getOrCreateUmamiGuestId()
    if (!resolvedVisitorId) return

    identifyUmamiVisitor(resolvedVisitorId, {
      auth_state: authState,
      role_bucket: roleBucket,
      locale,
      account_age_bucket: accountAgeBucket,
    })
  }, [accountAgeBucket, authState, locale, roleBucket, visitorId])

  useEffect(() => {
    if (!pathname) return

    const dashboardPattern = new RegExp(`^/${locale}/dashboard(?:/|$)`)
    if (!dashboardPattern.test(pathname)) return

    const key = `umami_dashboard_enter:${locale}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, "1")
    } catch {
      // 统计失败不影响页面功能
    }

    trackUmamiEvent("dashboard_enter", {
      locale,
      auth_state: authState,
      role_bucket: roleBucket,
    })
  }, [authState, locale, pathname, roleBucket])

  return null
}
