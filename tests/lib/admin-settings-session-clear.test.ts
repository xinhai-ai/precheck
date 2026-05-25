import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const clearUserSessionsRoutePath = new URL(
  "../../app/api/admin/clear-user-sessions/route.ts",
  import.meta.url,
)
const clearUserSessionsRouteSource = existsSync(clearUserSessionsRoutePath)
  ? readFileSync(clearUserSessionsRoutePath, "utf8")
  : ""
const settingsFormSource = readFileSync(
  new URL("../../components/admin/settings-form.tsx", import.meta.url),
  "utf8",
)
const zhDictSource = readFileSync(new URL("../../dictionaries/zh.json", import.meta.url), "utf8")
const enDictSource = readFileSync(new URL("../../dictionaries/en.json", import.meta.url), "utf8")

test("clear normal user sessions route keeps admin sessions", () => {
  assert.equal(existsSync(clearUserSessionsRoutePath), true)
  assert.match(clearUserSessionsRouteSource, /getCurrentUserFromRequest\(request\)/)
  assert.match(clearUserSessionsRouteSource, /isSuperAdmin\(user\.role\)/)
  assert.match(
    clearUserSessionsRouteSource,
    /db\.session\.deleteMany\(\{\s*where:\s*\{\s*user:\s*\{\s*role:\s*"USER",?\s*\}/,
  )
  assert.doesNotMatch(clearUserSessionsRouteSource, /db\.session\.deleteMany\(\s*\)/)
  assert.match(clearUserSessionsRouteSource, /SYSTEM_CLEAR_USER_SESSIONS/)
  assert.match(clearUserSessionsRouteSource, /deletedCount:\s*deleted\.count/)
})

test("admin settings danger zone exposes normal user session clearing", () => {
  assert.match(settingsFormSource, /clearUserSessionsOpen/)
  assert.match(settingsFormSource, /handleClearUserSessions/)
  assert.match(settingsFormSource, /\/api\/admin\/clear-user-sessions/)
  assert.match(settingsFormSource, /t\.clearUserSessions/)
  assert.match(settingsFormSource, /t\.clearUserSessionsConfirmTitle/)
})

test("session clearing copy exists in both dictionaries", () => {
  for (const source of [zhDictSource, enDictSource]) {
    assert.match(source, /"clearUserSessions"\s*:/)
    assert.match(source, /"clearUserSessionsDesc"\s*:/)
    assert.match(source, /"clearUserSessionsBtn"\s*:/)
    assert.match(source, /"clearUserSessionsSuccess"\s*:/)
    assert.match(source, /"clearUserSessionsFailed"\s*:/)
    assert.match(source, /"clearUserSessionsConfirmTitle"\s*:/)
    assert.match(source, /"clearUserSessionsConfirmDesc"\s*:/)
    assert.match(source, /"auditAction_SYSTEM_CLEAR_USER_SESSIONS"\s*:/)
  }
})
