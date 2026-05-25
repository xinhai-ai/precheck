"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { NewUserAnnouncementGate } from "@/components/dashboard/new-user-announcement-gate"
import { DashboardHeader } from "@/components/dashboard/header"
import { AvatarAllowlistProvider } from "@/components/ui/avatar-allowlist-provider"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Watermark } from "@/components/ui/watermark"
import type { Dictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"

type DashboardFeatureFlags = {
  userTicketsEnabled: boolean
  onlineSummary: DashboardOnlineSummary | null
}

type DashboardOnlineSummary = {
  total: number
  admins: number
}

type DashboardAnnouncement = {
  enabled: boolean
  content: string
  confirmText: string
  delaySeconds: number
  version: number
}

const DASHBOARD_ONLINE_REFRESH_MS = 30_000

const DashboardFeatureFlagsContext = createContext<DashboardFeatureFlags>({
  userTicketsEnabled: true,
  onlineSummary: null,
})

export function useDashboardFeatureFlags(): DashboardFeatureFlags {
  return useContext(DashboardFeatureFlagsContext)
}

export function useDashboardOnlineSummary(): DashboardOnlineSummary | null {
  return useContext(DashboardFeatureFlagsContext).onlineSummary
}

interface DashboardLayoutClientProps {
  locale: Locale
  dict: Dictionary
  user: { id: string; name?: string | null; email: string; role: string; avatar?: string | null }
  userTicketsEnabled: boolean
  allowedAvatarDomains: string[]
  announcement: DashboardAnnouncement
  children: React.ReactNode
}

export function DashboardLayoutClient({
  locale,
  dict,
  user,
  userTicketsEnabled,
  allowedAvatarDomains,
  announcement,
  children,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [onlineSummary, setOnlineSummary] = useState<DashboardOnlineSummary | null>(null)

  useEffect(() => {
    let active = true

    const fetchOnlineSummary = async () => {
      try {
        const res = await fetch("/api/dashboard/online")
        if (!res.ok) return

        const data = await res.json()
        if (!active) return

        setOnlineSummary({
          total: Number(data.total) || 0,
          admins: Number(data.admins) || 0,
        })
      } catch {
        // ignore
      }
    }

    fetchOnlineSummary()
    const timer = window.setInterval(fetchOnlineSummary, DASHBOARD_ONLINE_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <DashboardFeatureFlagsContext.Provider value={{ userTicketsEnabled, onlineSummary }}>
      <AvatarAllowlistProvider allowedAvatarDomains={allowedAvatarDomains}>
        <NewUserAnnouncementGate locale={locale} user={user} announcement={announcement} />
        <div className="flex min-h-screen bg-muted/30">
          {/* 水印 */}
          <Watermark userId={user.id} email={user.email} name={user.name ?? undefined} />

          {/* Desktop Sidebar */}
          <div className="hidden lg:block">
            <DashboardSidebar
              locale={locale}
              dict={dict}
              user={user}
              userTicketsEnabled={userTicketsEnabled}
            />
          </div>

          {/* Mobile Sidebar */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[280px] p-0">
              <DashboardSidebar
                locale={locale}
                dict={dict}
                user={user}
                userTicketsEnabled={userTicketsEnabled}
              />
            </SheetContent>
          </Sheet>

          <div className="flex flex-1 flex-col min-w-0">
            <DashboardHeader
              locale={locale}
              dict={dict}
              user={user}
              userTicketsEnabled={userTicketsEnabled}
              onMenuClick={() => setSidebarOpen(true)}
            />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </AvatarAllowlistProvider>
    </DashboardFeatureFlagsContext.Provider>
  )
}
