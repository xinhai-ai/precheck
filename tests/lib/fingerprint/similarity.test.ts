import test from "node:test"
import assert from "node:assert/strict"

async function loadSimilarityModule() {
  return import(new URL("../../../lib/fingerprint/similarity.ts", import.meta.url).href)
}

test("compareFingerprintComponents scores strong graphics matches highly", async () => {
  const { compareFingerprintComponents } = await loadSimilarityModule()
  const result = compareFingerprintComponents(
    {
      browser: { timezone: "Asia/Shanghai", languages: ["zh-CN", "en-US"] },
      screen: { width: 2560, height: 1440, colorDepth: 24 },
      graphics: { canvas: "abc", webglRenderer: "ANGLE NVIDIA RTX" },
      hardware: { hardwareConcurrency: 16, deviceMemory: 8 },
    },
    {
      browser: { timezone: "Asia/Shanghai", languages: ["zh-CN", "en-US"] },
      screen: { width: 1920, height: 1080, colorDepth: 24 },
      graphics: { canvas: "abc", webglRenderer: "ANGLE NVIDIA RTX" },
      hardware: { hardwareConcurrency: 16, deviceMemory: 8 },
    },
  )

  assert.equal(result.score >= 85, true)
  assert.ok(result.signals.matched.includes("graphics.canvas"))
  assert.ok(result.signals.strong.includes("graphics.webglRenderer"))
  assert.ok(result.signals.different.includes("screen.width"))
})

test("compareFingerprintComponents gives low score without stable matches", async () => {
  const { compareFingerprintComponents } = await loadSimilarityModule()
  const result = compareFingerprintComponents(
    { browser: { timezone: "Asia/Shanghai" }, graphics: { canvas: "abc" } },
    { browser: { timezone: "UTC" }, graphics: { canvas: "xyz" } },
  )

  assert.equal(result.score < 55, true)
  assert.ok(result.signals.different.includes("browser.timezone"))
})
