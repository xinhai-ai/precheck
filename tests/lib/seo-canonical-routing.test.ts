import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const middlewareSource = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8")
const sitemapSource = readFileSync(new URL("../../app/sitemap.xml/route.ts", import.meta.url), "utf8")
const seoSource = readFileSync(new URL("../../lib/seo.ts", import.meta.url), "utf8")

test("locale-less routes redirect deterministically to the default locale", () => {
  assert.doesNotMatch(middlewareSource, /accept-language/i)
  assert.match(middlewareSource, /request\.nextUrl\.pathname = `\/\$\{defaultLocale\}\$\{pathname\}`/)
})

test("sitemap does not expose the bare root URL as an indexable localized page", () => {
  assert.doesNotMatch(sitemapSource, /pushSitemapEntry\(entries, baseUrl, baseUrl/)
})

test("alternate URLs expose an x-default locale target", () => {
  assert.match(seoSource, /"x-default": `\$\{baseUrl\}\/\$\{defaultLocale\}\$\{path\}`/)
})
