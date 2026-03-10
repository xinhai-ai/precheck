import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sitemapSource = readFileSync(
  new URL("../../app/sitemap.xml/route.ts", import.meta.url),
  "utf8",
)

test("sitemap emits localized loc entries, including /zh", () => {
  assert.match(sitemapSource, /for \(const locale of locales\)/)
  assert.match(sitemapSource, /`\$\{baseUrl\}\/\$\{locale\}`/)
})
