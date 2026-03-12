import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { locales, defaultLocale } from "@/lib/i18n/config"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  )

  if (pathnameHasLocale) return NextResponse.next()

  request.nextUrl.pathname = `/${defaultLocale}${pathname}`
  return NextResponse.redirect(request.nextUrl, 308)
}

export const config = {
  matcher: [
    // 跳过静态资源、API 路由和特殊文件
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest|sitemap|robots|.*\\..*).*)",
  ],
}
