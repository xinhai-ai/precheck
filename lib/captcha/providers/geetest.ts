import { createHmac } from "node:crypto"

const GEETEST_VERIFY_URL = "https://gcaptcha4.geetest.com/validate"

export type GeeTestVerifyResult = {
  ok: boolean
  detail?: string
}

type GeeTestValidateResponse = {
  result?: string
  reason?: string
  status?: string
  code?: string
  msg?: string
}

function normalizePayloadValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }

  return ""
}

function buildDetail(response: GeeTestValidateResponse): string | undefined {
  const parts = [
    typeof response.reason === "string" ? response.reason.trim() : "",
    typeof response.msg === "string" ? response.msg.trim() : "",
    typeof response.code === "string" ? `code=${response.code.trim()}` : "",
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(" | ") : undefined
}

export async function verifyGeeTestPayload(
  payload: Record<string, unknown>,
): Promise<GeeTestVerifyResult> {
  const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID?.trim()
  const captchaKey = process.env.GEETEST_CAPTCHA_KEY?.trim()
  const lotNumber = normalizePayloadValue(payload.lot_number)
  const captchaOutput = normalizePayloadValue(payload.captcha_output)
  const passToken = normalizePayloadValue(payload.pass_token)
  const genTime = normalizePayloadValue(payload.gen_time)

  if (!captchaId || !captchaKey) {
    return { ok: false, detail: "GeeTest 环境变量未配置完整" }
  }

  if (!lotNumber || !captchaOutput || !passToken || !genTime) {
    return { ok: false, detail: "GeeTest 验证参数不完整" }
  }

  const signToken = createHmac("sha256", captchaKey).update(lotNumber).digest("hex")
  const formData = new URLSearchParams({
    lot_number: lotNumber,
    captcha_output: captchaOutput,
    pass_token: passToken,
    gen_time: genTime,
    sign_token: signToken,
  })

  try {
    const response = await fetch(
      `${GEETEST_VERIFY_URL}?captcha_id=${encodeURIComponent(captchaId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      },
    )

    const data = (await response.json()) as GeeTestValidateResponse
    if (response.ok && data.result === "success") {
      return { ok: true }
    }

    const detail = buildDetail(data) || (!response.ok ? `HTTP ${response.status}` : undefined)
    console.warn("GeeTest secondary verification rejected:", {
      httpStatus: response.status,
      response: data,
    })
    return { ok: false, detail }
  } catch (error) {
    console.error("GeeTest verification failed:", error)
    return { ok: false, detail: "GeeTest 服务请求失败" }
  }
}
