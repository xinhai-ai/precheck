import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { AdminPreApplicationsTable } from "@/components/admin/pre-applications-table"
import { getCurrentUser } from "@/lib/auth/session"

interface AdminPreApplicationsPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function AdminPreApplicationsPage({ params }: AdminPreApplicationsPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)
  const currentUser = await getCurrentUser()

  return (
    <AdminPreApplicationsTable
      locale={locale}
      dict={dict}
      currentUserRole={currentUser?.role ?? null}
    />
  )
}
