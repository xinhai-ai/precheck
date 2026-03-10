import test from "node:test"
import assert from "node:assert/strict"
import { verifyGeeTestPayload } from "../../lib/captcha/providers/geetest.ts"

const originalFetch = global.fetch
const originalCaptchaId = process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID
const originalCaptchaKey = process.env.GEETEST_CAPTCHA_KEY

function restoreEnv() {
  if (originalCaptchaId === undefined) delete process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID
  else process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID = originalCaptchaId

  if (originalCaptchaKey === undefined) delete process.env.GEETEST_CAPTCHA_KEY
  else process.env.GEETEST_CAPTCHA_KEY = originalCaptchaKey

  global.fetch = originalFetch
}

test("geetest verifier accepts numeric gen_time from frontend payload", async () => {
  process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID = "captcha-id"
  process.env.GEETEST_CAPTCHA_KEY = "captcha-key"

  global.fetch = async (_input, init) => {
    const form = new URLSearchParams(String(init?.body ?? ""))
    assert.equal(form.get("lot_number"), "lot-1")
    assert.equal(form.get("captcha_output"), "output-1")
    assert.equal(form.get("pass_token"), "pass-1")
    assert.equal(form.get("gen_time"), "1710000000")
    assert.equal(typeof form.get("sign_token"), "string")

    return new Response(JSON.stringify({ result: "success", reason: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = await verifyGeeTestPayload({
    lot_number: "lot-1",
    captcha_output: "output-1",
    pass_token: "pass-1",
    gen_time: 1710000000,
  })

  assert.equal(typeof result, "object")
  assert.equal(result.ok, true)
  restoreEnv()
})

test("geetest verifier returns provider error detail for server-side validate errors", async () => {
  process.env.NEXT_PUBLIC_GEETEST_CAPTCHA_ID = "captcha-id"
  process.env.GEETEST_CAPTCHA_KEY = "captcha-key"

  global.fetch = async () =>
    new Response(JSON.stringify({ status: "error", code: "-50005", msg: "illegal gen_time" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })

  const result = await verifyGeeTestPayload({
    lot_number: "lot-1",
    captcha_output: "output-1",
    pass_token: "pass-1",
    gen_time: "1710000000",
  })

  assert.equal(result.ok, false)
  assert.match(result.detail ?? "", /illegal gen_time/)
  assert.match(result.detail ?? "", /-50005/)
  restoreEnv()
})
