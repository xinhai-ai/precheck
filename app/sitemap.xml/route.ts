import { locales, defaultLocale } from "@/lib/i18n/config"
import { getBaseUrl } from "@/lib/seo"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

// 静态路由配置
const staticRoutes = [
  { path: "", changeFrequency: "daily", priority: 1.0 },
  { path: "/login", changeFrequency: "monthly", priority: 0.6 },
  { path: "/register", changeFrequency: "monthly", priority: 0.6 },
  { path: "/forgot-password", changeFrequency: "yearly", priority: 0.4 },
  { path: "/reset-password", changeFrequency: "yearly", priority: 0.3 },
  { path: "/pre-application", changeFrequency: "monthly", priority: 0.8 },
  { path: "/posts", changeFrequency: "daily", priority: 0.8 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
  { path: "/docs/api", changeFrequency: "monthly", priority: 0.6 },
  { path: "/docs/examples", changeFrequency: "monthly", priority: 0.6 },
  { path: "/changelog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/license", changeFrequency: "yearly", priority: 0.3 },
]

function buildAlternates(baseUrl: string, path: string): string {
  const links = locales
    .map(
      (locale) =>
        `      <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}${path}"/>`,
    )
    .join("\n")
  return `${links}\n      <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/${defaultLocale}${path}"/>`
}

function getLastModified(type: "static" | "dynamic" = "static"): string {
  if (type === "dynamic") {
    return new Date().toISOString()
  }
  return "2025-01-25T00:00:00.000Z"
}

function pushSitemapEntry(
  entries: string[],
  baseUrl: string,
  loc: string,
  lastmod: string,
  changefreq: string,
  priority: number,
  alternatesPath: string,
) {
  entries.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${buildAlternates(baseUrl, alternatesPath)}
  </url>`)
}

export async function GET() {
  const baseUrl = getBaseUrl()
  const entries: string[] = []

  // 根路由
  pushSitemapEntry(entries, baseUrl, baseUrl, getLastModified("dynamic"), "daily", 1.0, "")

  for (const locale of locales) {
    pushSitemapEntry(
      entries,
      baseUrl,
      `${baseUrl}/${locale}`,
      getLastModified("dynamic"),
      "daily",
      0.9,
      "",
    )
  }

  // 静态路由
  for (const route of staticRoutes) {
    if (route.path === "") continue

    for (const locale of locales) {
      pushSitemapEntry(
        entries,
        baseUrl,
        `${baseUrl}/${locale}${route.path}`,
        getLastModified("static"),
        route.changeFrequency,
        route.priority,
        route.path,
      )
    }
  }

  // 动态内容 - 已发布文章
  if (db) {
    try {
      const posts = await db.post.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 1000,
      })

      for (const post of posts) {
        const postPath = `/posts/${post.id}`

        for (const locale of locales) {
          pushSitemapEntry(
            entries,
            baseUrl,
            `${baseUrl}/${locale}${postPath}`,
            post.updatedAt.toISOString(),
            "weekly",
            0.7,
            postPath,
          )
        }
      }
    } catch (error) {
      console.warn("Sitemap: Database unavailable, skipping posts", error)
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-style.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>`

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
