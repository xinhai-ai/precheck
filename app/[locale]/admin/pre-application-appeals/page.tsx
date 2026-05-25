import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/session"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { AdminPreApplicationAppealsTable } from "@/components/admin/pre-application-appeals-table"
import { canViewPreApplicationAppeals } from "@/lib/auth/policies/pre-application-appeal"

interface AdminPreApplicationAppealsPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function AdminPreApplicationAppealsPage({
  params,
}: AdminPreApplicationAppealsPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)
  const currentUser = await getCurrentUser()

  if (!canViewPreApplicationAppeals(currentUser)) {
    redirect(`/${locale}/error/403`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{dict.admin.preApplicationAppealsPage.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {dict.admin.preApplicationAppealsPage.description}
        </p>
      </div>

      <AdminPreApplicationAppealsTable locale={locale} dict={dict} />
    </div>
  )
}
