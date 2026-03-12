import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

const schemaUrl = new URL("../../../prisma/schema.prisma", import.meta.url)
const migrationUrl = new URL(
  "../../../prisma/migrations/202603120001_add_passkey_credentials/migration.sql",
  import.meta.url,
)
const passkeyLibUrl = new URL("../../../lib/auth/passkey.ts", import.meta.url)
const registerOptionsRouteUrl = new URL(
  "../../../app/api/auth/passkey/register/options/route.ts",
  import.meta.url,
)
const registerVerifyRouteUrl = new URL(
  "../../../app/api/auth/passkey/register/verify/route.ts",
  import.meta.url,
)
const authOptionsRouteUrl = new URL(
  "../../../app/api/auth/passkey/authenticate/options/route.ts",
  import.meta.url,
)
const authVerifyRouteUrl = new URL(
  "../../../app/api/auth/passkey/authenticate/verify/route.ts",
  import.meta.url,
)
const dashboardPasskeysRouteUrl = new URL(
  "../../../app/api/dashboard/passkeys/route.ts",
  import.meta.url,
)
const dashboardPasskeyDeleteRouteUrl = new URL(
  "../../../app/api/dashboard/passkeys/[id]/route.ts",
  import.meta.url,
)
const settingsPageUrl = new URL("../../../app/[locale]/dashboard/settings/page.tsx", import.meta.url)
const settingsFormUrl = new URL("../../../components/dashboard/settings-form.tsx", import.meta.url)
const passkeySettingsCardUrl = new URL(
  "../../../components/dashboard/passkey-settings-card.tsx",
  import.meta.url,
)
const loginFormUrl = new URL("../../../components/auth/login-form.tsx", import.meta.url)
const passkeyLoginButtonUrl = new URL(
  "../../../components/auth/passkey-login-button.tsx",
  import.meta.url,
)
const packageJsonUrl = new URL("../../../package.json", import.meta.url)
const errorKeysUrl = new URL("../../../lib/api/error-keys.ts", import.meta.url)
const zhDictUrl = new URL("../../../dictionaries/zh.json", import.meta.url)
const enDictUrl = new URL("../../../dictionaries/en.json", import.meta.url)

const schemaSource = readFileSync(schemaUrl, "utf8")
const passkeyLibSource = readIfExists(passkeyLibUrl)
const registerOptionsRouteSource = readIfExists(registerOptionsRouteUrl)
const registerVerifyRouteSource = readIfExists(registerVerifyRouteUrl)
const authOptionsRouteSource = readIfExists(authOptionsRouteUrl)
const authVerifyRouteSource = readIfExists(authVerifyRouteUrl)
const dashboardPasskeysRouteSource = readIfExists(dashboardPasskeysRouteUrl)
const dashboardPasskeyDeleteRouteSource = readIfExists(dashboardPasskeyDeleteRouteUrl)
const settingsPageSource = readFileSync(settingsPageUrl, "utf8")
const settingsFormSource = readFileSync(settingsFormUrl, "utf8")
const passkeySettingsCardSource = readIfExists(passkeySettingsCardUrl)
const loginFormSource = readFileSync(loginFormUrl, "utf8")
const passkeyLoginButtonSource = readIfExists(passkeyLoginButtonUrl)
const packageJsonSource = readFileSync(packageJsonUrl, "utf8")
const errorKeysSource = readFileSync(errorKeysUrl, "utf8")
const zhDictSource = readFileSync(zhDictUrl, "utf8")
const enDictSource = readFileSync(enDictUrl, "utf8")

test("schema persists passkey credentials", () => {
  assert.equal(existsSync(migrationUrl), true)
  assert.match(schemaSource, /model PasskeyCredential/)
  assert.match(schemaSource, /passkeyCredentials\s+PasskeyCredential\[]/)
  assert.match(schemaSource, /credentialID\s+String\s+@unique/)
  assert.match(schemaSource, /counter\s+BigInt|counter\s+Int/)
})

test("server exposes passkey helper and auth routes", () => {
  assert.equal(existsSync(passkeyLibUrl), true)
  assert.equal(existsSync(registerOptionsRouteUrl), true)
  assert.equal(existsSync(registerVerifyRouteUrl), true)
  assert.equal(existsSync(authOptionsRouteUrl), true)
  assert.equal(existsSync(authVerifyRouteUrl), true)
  assert.match(passkeyLibSource, /generateRegistrationOptions|verifyRegistrationResponse/)
  assert.match(passkeyLibSource, /generateAuthenticationOptions|verifyAuthenticationResponse/)
  assert.match(registerOptionsRouteSource, /getCurrentUser/)
  assert.match(registerVerifyRouteSource, /getCurrentUser/)
  assert.match(authVerifyRouteSource, /createSession/)
  assert.match(authVerifyRouteSource, /setSessionCookie/)
})

test("dashboard settings expose passkey management for logged-in users", () => {
  assert.equal(existsSync(dashboardPasskeysRouteUrl), true)
  assert.equal(existsSync(dashboardPasskeyDeleteRouteUrl), true)
  assert.equal(existsSync(passkeySettingsCardUrl), true)
  assert.match(settingsPageSource, /PasskeySettingsCard/)
  assert.match(settingsFormSource, /passkey/i)
  assert.match(passkeySettingsCardSource, /\/api\/dashboard\/passkeys/)
  assert.match(dashboardPasskeyDeleteRouteSource, /getCurrentUser/)
})

test("login form exposes passkey login flow", () => {
  assert.equal(existsSync(passkeyLoginButtonUrl), true)
  assert.match(loginFormSource, /PasskeyLoginButton/)
  assert.match(passkeyLoginButtonSource, /startAuthentication/)
  assert.match(passkeyLoginButtonSource, /\/api\/auth\/passkey\/authenticate\/options/)
  assert.match(passkeyLoginButtonSource, /\/api\/auth\/passkey\/authenticate\/verify/)
})

test("dependencies and copy include passkey support", () => {
  assert.match(packageJsonSource, /@simplewebauthn\/server/)
  assert.match(packageJsonSource, /@simplewebauthn\/browser/)
  assert.match(errorKeysSource, /passkey/)
  assert.match(zhDictSource, /passkey|通行密钥/)
  assert.match(enDictSource, /passkey/)
})
