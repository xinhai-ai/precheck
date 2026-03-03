import { getCurrentUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { AdminRiskControlCenter } from "@/components/admin/risk-control-center"

interface AdminRiskControlPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function AdminRiskControlPage({ params }: AdminRiskControlPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)
  const user = await getCurrentUser()

  return <AdminRiskControlCenter locale={locale} dict={dict} currentRole={user?.role ?? "USER"} />
}
