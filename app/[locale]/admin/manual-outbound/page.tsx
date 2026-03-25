import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { isSuperAdmin } from "@/lib/auth/permissions"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { AdminManualOutboundForm } from "@/components/admin/manual-outbound-form"

interface AdminManualOutboundPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function AdminManualOutboundPage({ params }: AdminManualOutboundPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)
  const user = await getCurrentUser()

  if (!user || !isSuperAdmin(user.role)) {
    redirect(`/${locale}/error/403`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{dict.admin.manualOutbound}</h1>
        <p className="mt-1 text-muted-foreground">{dict.admin.manualOutboundDesc}</p>
      </div>
      <AdminManualOutboundForm locale={locale} dict={dict} />
    </div>
  )
}
