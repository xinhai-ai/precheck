import test from "node:test"
import assert from "node:assert/strict"

async function loadComponentsModule() {
  return import(new URL("../../../lib/fingerprint/components.ts", import.meta.url).href)
}

test("sanitizeFingerprintComponents keeps allowed groups and trims large values", async () => {
  const { sanitizeFingerprintComponents } = await loadComponentsModule()
  const result = sanitizeFingerprintComponents({
    browser: {
      userAgent: " Mozilla/5.0 ",
      languages: ["zh-CN", "en-US", "x".repeat(900)],
      unknown: "removed",
    },
    screen: {
      width: 2560,
      height: 1440,
      colorDepth: 24,
    },
    graphics: {
      canvas: "canvas-signature",
      webglVendor: "Google Inc.",
      webglRenderer: "ANGLE NVIDIA RTX",
    },
    unknownGroup: { value: "removed" },
  })

  assert.equal(result.components.browser.userAgent, "Mozilla/5.0")
  assert.deepEqual(result.components.browser.languages, ["zh-CN", "en-US", "x".repeat(512)])
  assert.equal("unknown" in result.components.browser, false)
  assert.equal("unknownGroup" in result.components, false)
  assert.deepEqual(result.componentKeys, [
    "browser.languages",
    "browser.userAgent",
    "graphics.canvas",
    "graphics.webglRenderer",
    "graphics.webglVendor",
    "screen.colorDepth",
    "screen.height",
    "screen.width",
  ])
})

test("buildFingerprintBinding creates stable hashes independent of object key order", async () => {
  const { buildFingerprintBinding } = await loadComponentsModule()
  const first = buildFingerprintBinding(
    {
      screen: { width: 2560, height: 1440 },
      browser: { timezone: "Asia/Shanghai", languages: ["zh-CN", "en-US"] },
      graphics: { webglRenderer: "ANGLE NVIDIA RTX", canvas: "abc" },
    },
    "pepper",
  )
  const second = buildFingerprintBinding(
    {
      graphics: { canvas: "abc", webglRenderer: "ANGLE NVIDIA RTX" },
      browser: { languages: ["zh-CN", "en-US"], timezone: "Asia/Shanghai" },
      screen: { height: 1440, width: 2560 },
    },
    "pepper",
  )

  assert.equal(first.fingerprintHash, second.fingerprintHash)
  assert.deepEqual(first.basis, second.basis)
  assert.match(first.fingerprintHash || "", /^[a-f0-9]{64}$/)
})

test("buildFingerprintSummary extracts admin review fields", async () => {
  const { buildFingerprintSummary } = await loadComponentsModule()
  const summary = buildFingerprintSummary({
    browser: {
      userAgent: "Mozilla/5.0",
      platform: "Win32",
      timezone: "Asia/Shanghai",
      languages: ["zh-CN", "en-US"],
    },
    screen: { width: 2560, height: 1440, devicePixelRatio: 1.25 },
    graphics: { webglVendor: "Google Inc.", webglRenderer: "ANGLE NVIDIA RTX", canvas: "abc" },
    hardware: { hardwareConcurrency: 16, deviceMemory: 8, maxTouchPoints: 0 },
  })

  assert.deepEqual(summary, {
    browser: "Mozilla/5.0",
    platform: "Win32",
    timezone: "Asia/Shanghai",
    languages: ["zh-CN", "en-US"],
    screen: "2560×1440 @1.25x",
    webgl: "Google Inc. / ANGLE NVIDIA RTX",
    canvasPresent: true,
    hardware: "16 cores / 8 GB / touch 0",
  })
})
