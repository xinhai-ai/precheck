import type { Metadata } from "next"
import { getDictionary } from "@/lib/i18n/get-dictionary"
import type { Locale } from "@/lib/i18n/config"
import { FingerprintsTable } from "@/components/admin/fingerprints-table"

interface FingerprintsPageProps {
  params: Promise<{ locale: Locale }>
}

export async function generateMetadata({
  params,
}: FingerprintsPageProps): Promise<Metadata> {
  const { locale } = await params
  const dict = await getDictionary(locale)
  return {
    title: dict.admin.fingerprint.management,
    description: dict.admin.fingerprint.managementDesc,
  }
}

export default async function FingerprintsPage({ params }: FingerprintsPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{dict.admin.fingerprint.management}</h1>
        <p className="text-muted-foreground">{dict.admin.fingerprint.managementDesc}</p>
      </div>
      <FingerprintsTable locale={locale} dict={dict} />
    </div>
  )
}
