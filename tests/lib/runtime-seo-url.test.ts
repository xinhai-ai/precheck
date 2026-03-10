import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const seoSource = readFileSync(new URL("../../lib/seo.ts", import.meta.url), "utf8")
const envExampleSource = readFileSync(new URL("../../.env.example", import.meta.url), "utf8")
const readmeSource = readFileSync(new URL("../../README.md", import.meta.url), "utf8")
const readmeZhSource = readFileSync(new URL("../../README.zh-CN.md", import.meta.url), "utf8")

test("seo base url prefers runtime APP_URL and trims trailing slash", () => {
  assert.match(seoSource, /process\.env\.APP_URL/)
  assert.ok(seoSource.includes('replace(/\\/$/, "")'))
})

test("seo base url keeps legacy fallbacks for existing deployments", () => {
  assert.match(seoSource, /process\.env\.NEXT_PUBLIC_APP_URL/)
  assert.match(seoSource, /process\.env\.NEXT_PUBLIC_SITE_URL/)
  assert.match(seoSource, /process\.env\.VERCEL_URL/)
})

test("runtime APP_URL is documented in env example and readmes", () => {
  for (const source of [envExampleSource, readmeSource, readmeZhSource]) {
    assert.match(source, /APP_URL/)
  }
})
