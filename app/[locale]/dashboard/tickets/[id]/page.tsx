import { redirect } from "next/navigation"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { getCurrentUser } from "@/lib/auth/session"
import { TicketDetail } from "@/components/dashboard/ticket-detail"
import { getSiteSettings } from "@/lib/site-settings"

interface TicketDetailPageProps {
  params: Promise<{ locale: Locale; id: string }>
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { locale, id } = await params
  const dict = await getDictionary(locale)
  const user = await getCurrentUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const settings = await getSiteSettings()
  if (!settings.userTicketsEnabled) {
    redirect(`/${locale}/dashboard`)
  }

  return <TicketDetail locale={locale} dict={dict} ticketId={id} userId={user.id} />
}
