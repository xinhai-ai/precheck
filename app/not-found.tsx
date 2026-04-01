import { getDictionary } from "@/lib/i18n/get-dictionary"
import { defaultLocale } from "@/lib/i18n/config"
import { ErrorPage } from "@/components/errors/error-page"

export default async function NotFound() {
  const dictionary = await getDictionary(defaultLocale)

  return <ErrorPage code="404" dictionary={dictionary} locale={defaultLocale} />
}
