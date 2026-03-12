import { defaultLocale, locales, type Locale } from "@/lib/i18n/config"

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "")
}

export function getBaseUrl() {
  const configuredUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl)
  }

  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.startsWith("http")
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`

    return normalizeBaseUrl(vercelUrl)
  }

  return "http://localhost:3000"
}

export const siteConfig = {
  name: "预申请系统",
  shortName: "预申请",
  url: getBaseUrl(),
  ogImage: "/placeholder-logo.svg",
  logo: "/placeholder-logo.svg",
  description: "社区预申请与邀请码管理平台",
  keywords: ["预申请", "邀请码", "社区注册", "邀请码管理", "社区申请"],
  links: {
    github: "https://github.com/dext7r/precheck",
    twitter: "https://twitter.com/",
    community: "",
  },
  contact: {
    email: "",
  },
}

export function getCanonicalUrl(path: string, locale?: Locale) {
  const baseUrl = getBaseUrl()
  const localePath = locale ? `/${locale}` : ""
  return `${baseUrl}${localePath}${path}`
}

export function getAlternateUrls(path: string) {
  const baseUrl = getBaseUrl()
  return locales.reduce(
    (acc, locale) => {
      acc[locale] = `${baseUrl}/${locale}${path}`
      return acc
    },
    {
      "x-default": `${baseUrl}/${defaultLocale}${path}`,
    } as Record<string, string>,
  )
}

export interface PageSEO {
  title: string
  description: string
  path: string
  locale: Locale
  image?: string
  type?: "website" | "article"
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  keywords?: string[]
}

export function generatePageMetadata({
  title,
  description,
  path,
  locale,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  authors,
  keywords,
}: PageSEO) {
  const url = getCanonicalUrl(path, locale)
  const alternates = getAlternateUrls(path)

  return {
    title,
    description,
    keywords,
    authors: authors?.map((name) => ({ name })),
    alternates: {
      canonical: url,
      languages: alternates,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type,
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: title }] }),
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [image] }),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  }
}
