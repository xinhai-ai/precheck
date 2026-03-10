import { createHmac } from "node:crypto"

const GEETEST_VERIFY_URL = "https://gcaptcha4.geetest.com/validate"

export async function verifyGeeTestPayload(payload: Record<string, unknown>): Promise<boolean> {
  const captchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID?.trim()
  const captchaKey = process.env.GEETEST_CAPTCHA_KEY?.trim()
  const lotNumber = typeof payload.lot_number === "string" ? payload.lot_number.trim() : ""
  const captchaOutput =
    typeof payload.captcha_output === "string" ? payload.captcha_output.trim() : ""
  const passToken = typeof payload.pass_token === "string" ? payload.pass_token.trim() : ""
  const genTime = typeof payload.gen_time === "string" ? payload.gen_time.trim() : ""

  if (!captchaId || !captchaKey || !lotNumber || !captchaOutput || !passToken || !genTime) {
    return false
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
    const response = await fetch(`${GEETEST_VERIFY_URL}?captcha_id=${encodeURIComponent(captchaId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })
    const data = (await response.json()) as { result?: string }
    return data.result === "success"
  } catch (error) {
    console.error("GeeTest verification failed:", error)
    return false
  }
}
