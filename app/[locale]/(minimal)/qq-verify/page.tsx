import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import type { Locale } from "@/lib/i18n/config"

interface QQVerifyPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function QQVerifyPage({ params }: QQVerifyPageProps) {
  const { locale } = await params

  const user = await getCurrentUser()
  if (user) {
    redirect(`/${locale}/dashboard/pre-application`)
  }

  redirect(`/${locale}/login`)
}
