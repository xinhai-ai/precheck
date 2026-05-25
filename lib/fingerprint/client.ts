"use client"

import type { FingerprintComponents, FingerprintPayload } from "@/lib/fingerprint/types"

function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 120) || "sdk_error"
  }
  return "sdk_error"
}

async function safePermission(name: PermissionName): Promise<string> {
  try {
    if (!navigator.permissions?.query) return "unsupported"
    const result = await navigator.permissions.query({ name })
    return result.state
  } catch {
    return "unavailable"
  }
}

function readBoolean(check: () => unknown): boolean {
  try {
    return Boolean(check())
  } catch {
    return false
  }
}

function getCanvasSignature(): string | null {
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 240
    canvas.height = 60
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.textBaseline = "top"
    ctx.font = "16px serif"
    ctx.fillStyle = "#f60"
    ctx.fillRect(0, 0, 120, 40)
    ctx.fillStyle = "#069"
    ctx.fillText("precheck fingerprint", 2, 2)
    return canvas.toDataURL().slice(0, 512)
  } catch {
    return null
  }
}

function getWebglInfo() {
  try {
    const canvas = document.createElement("canvas")
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null
    if (!gl) return {}
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info")
    return {
      webglVendor: debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
        : String(gl.getParameter(gl.VENDOR)),
      webglRenderer: debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER)),
      webglVersion: String(gl.getParameter(gl.VERSION)),
      webglShadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
      webglParameters: {
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
        maxViewportDims: Array.from((gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array) || []),
      },
    }
  } catch {
    return {}
  }
}

function detectFonts(): string[] {
  if (!document.body) return []

  const candidates = [
    "Arial",
    "Consolas",
    "Courier New",
    "Georgia",
    "Microsoft YaHei",
    "PingFang SC",
    "SimSun",
    "Times New Roman",
  ]
  const baseFonts = ["monospace", "sans-serif", "serif"]
  const testText = "mmmmmmmmmmlli"
  const span = document.createElement("span")
  span.style.fontSize = "72px"
  span.style.position = "absolute"
  span.style.left = "-9999px"
  span.textContent = testText
  document.body.appendChild(span)

  try {
    const baseSizes = new Map<string, { width: number; height: number }>()
    for (const base of baseFonts) {
      span.style.fontFamily = base
      baseSizes.set(base, { width: span.offsetWidth, height: span.offsetHeight })
    }

    return candidates.filter((font) =>
      baseFonts.some((base) => {
        span.style.fontFamily = `${font}, ${base}`
        const size = baseSizes.get(base)
        return size && (span.offsetWidth !== size.width || span.offsetHeight !== size.height)
      }),
    )
  } finally {
    document.body.removeChild(span)
  }
}

async function buildFingerprintComponents(): Promise<FingerprintComponents> {
  const nav = navigator as Navigator & { deviceMemory?: number; webdriver?: boolean }
  const permissions = {
    notifications: await safePermission("notifications"),
    geolocation: await safePermission("geolocation"),
    camera: await safePermission("camera"),
    microphone: await safePermission("microphone"),
  }

  return {
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: Array.from(navigator.languages || []),
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      vendor: navigator.vendor,
      webdriver: nav.webdriver ?? false,
    },
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      devicePixelRatio: window.devicePixelRatio,
      orientation: screen.orientation?.type || "unknown",
    },
    hardware: {
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: nav.deviceMemory ?? null,
      maxTouchPoints: navigator.maxTouchPoints,
    },
    graphics: {
      canvas: getCanvasSignature(),
      ...getWebglInfo(),
    },
    media: {
      mediaDevices: Boolean(navigator.mediaDevices),
      mimeTypes: navigator.mimeTypes?.length ?? 0,
      plugins: navigator.plugins?.length ?? 0,
    },
    storage: {
      localStorage: readBoolean(() => window.localStorage),
      sessionStorage: readBoolean(() => window.sessionStorage),
      indexedDB: readBoolean(() => window.indexedDB),
      serviceWorker: Boolean(navigator.serviceWorker),
      cookies: navigator.cookieEnabled,
    },
    fonts: {
      available: detectFonts(),
      count: document.fonts?.size ?? null,
    },
    features: {
      wasm: typeof WebAssembly !== "undefined",
      webgpu: "gpu" in navigator,
      webrtc: typeof RTCPeerConnection !== "undefined",
      permissions,
      touch: navigator.maxTouchPoints > 0,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
  }
}

export async function collectFingerprint(): Promise<FingerprintPayload> {
  if (process.env.NEXT_PUBLIC_FEATURE_FINGERPRINT === "false") {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: "feature_disabled",
    }
  }

  try {
    return {
      fingerprintStatus: "OK",
      fingerprintComponents: await buildFingerprintComponents(),
    }
  } catch (error) {
    return {
      fingerprintStatus: "COLLECTION_FAILED",
      fingerprintFailureReason: toFailureReason(error),
    }
  }
}
