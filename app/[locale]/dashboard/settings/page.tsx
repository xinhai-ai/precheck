import { getDictionary } from "@/lib/i18n/get-dictionary"
import { getCurrentUser } from "@/lib/auth/session"
import { SettingsForm } from "@/components/dashboard/settings-form"
import { PasskeySettingsCard } from "@/components/dashboard/passkey-settings-card"
import { getSiteSettings } from "@/lib/site-settings"
import type { Locale } from "@/lib/i18n/config"

interface SettingsPageProps {
  params: Promise<{ locale: Locale }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params
  const dict = await getDictionary(locale)
  const user = await getCurrentUser()
  const settings = await getSiteSettings()

  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      <SettingsForm
        locale={locale}
        dict={dict}
        user={{ name: user.name, email: user.email, avatar: user.avatar, role: user.role }}
        hasPassword={!!user.password}
        allowedAvatarDomains={settings.allowedAvatarDomains}
      />
      <PasskeySettingsCard locale={locale} dict={dict} />
    </div>
  )
}
