import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const files = [
  "../../app/robots.ts",
  "../../app/sitemap.xml/route.ts",
  "../../app/feed.xml/route.ts",
  "../../app/atom.xml/route.ts",
  "../../app/llms.txt/route.ts",
  "../../app/[locale]/feed.xml/route.ts",
  "../../app/[locale]/atom.xml/route.ts",
] as const

for (const file of files) {
  test(`${file} forces runtime execution for APP_URL`, () => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8")
    assert.match(source, /export const dynamic = "force-dynamic"/)
  })
}
