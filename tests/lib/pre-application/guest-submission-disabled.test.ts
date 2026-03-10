import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const guestApplyPage = readFileSync(
  new URL("../../../app/[locale]/(minimal)/guest/apply/page.tsx", import.meta.url),
  "utf8",
)
const qqVerifyPage = readFileSync(
  new URL("../../../app/[locale]/(minimal)/qq-verify/page.tsx", import.meta.url),
  "utf8",
)
const qqVerifyForm = readFileSync(
  new URL("../../../components/auth/qq-verify-form.tsx", import.meta.url),
  "utf8",
)
const qqVerifyApi = readFileSync(
  new URL("../../../app/api/qq-verify/route.ts", import.meta.url),
  "utf8",
)

test("guest apply page no longer renders guest submit form", () => {
  assert.doesNotMatch(guestApplyPage, /GuestApplyForm/)
  assert.match(guestApplyPage, /redirect\(`\/\$\{locale\}\/login`\)/)
  assert.match(guestApplyPage, /redirect\(`\/\$\{locale\}\/dashboard\/pre-application`\)/)
  assert.doesNotMatch(guestApplyPage, /qq-verify\?redirect=\/\$\{locale\}\/guest\/apply/)
})

test("qq verify page no longer continues guest submit flow", () => {
  assert.doesNotMatch(qqVerifyPage, /QQVerifyForm/)
  assert.doesNotMatch(qqVerifyPage, /guest\/apply/)
  assert.match(qqVerifyPage, /redirect\(`\/\$\{locale\}\/login`\)/)
})

test("qq verify form no longer falls back to guest apply", () => {
  assert.doesNotMatch(qqVerifyForm, /`\/\$\{locale\}\/guest\/apply`/)
  assert.match(qqVerifyForm, /`\/\$\{locale\}\/login`/)
})

test("qq verify API is disabled with login-only message", () => {
  assert.match(qqVerifyApi, /游客提交已关闭，请登录后申请/)
  assert.match(qqVerifyApi, /status:\s*403/)
})
