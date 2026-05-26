import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const layoutSource = readFileSync(new URL("../../app/[locale]/layout.tsx", import.meta.url), "utf8")

test("locale layout includes the Umami analytics script", () => {
  assert.match(layoutSource, /id="umami-analytics"/)
  assert.match(layoutSource, /src="https:\/\/umami\.anglergap\.org\/script\.js"/)
  assert.match(layoutSource, /data-website-id="9c8968bf-63bd-4a3c-9fe1-cae957f1d22a"/)
  assert.match(layoutSource, /defer/)
})

test("Umami analytics follows the site analytics switch", () => {
  const analyticsBlock = layoutSource.slice(
    layoutSource.indexOf("{analyticsEnabled &&"),
    layoutSource.indexOf("<WebsiteJsonLd"),
  )

  assert.match(analyticsBlock, /id="umami-analytics"/)
})
