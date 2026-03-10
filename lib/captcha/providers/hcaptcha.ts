const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify"

export async function verifyHCaptchaPayload(
  payload: Record<string, unknown>,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET_KEY?.trim()
  const token = typeof payload.token === "string" ? payload.token.trim() : ""

  if (!secret || !token) {
    return false
  }

  const formData = new URLSearchParams()
  formData.append("secret", secret)
  formData.append("response", token)
  if (remoteIp) {
    formData.append("remoteip", remoteIp)
  }

  try {
    const response = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData,
    })
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error("hCaptcha verification failed:", error)
    return false
  }
}
