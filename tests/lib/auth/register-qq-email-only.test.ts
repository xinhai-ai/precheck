import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

const schemaUrl = new URL("../../../prisma/schema.prisma", import.meta.url)
const siteSettingsUrl = new URL("../../../lib/site-settings.ts", import.meta.url)
const adminSystemConfigRouteUrl = new URL(
  "../../../app/api/admin/system-config/route.ts",
  import.meta.url,
)
const publicSystemConfigRouteUrl = new URL(
  "../../../app/api/public/system-config/route.ts",
  import.meta.url,
)
const adminSettingsFormUrl = new URL("../../../components/admin/settings-form.tsx", import.meta.url)
const registerFormUrl = new URL("../../../components/auth/register-form.tsx", import.meta.url)
const sendCodeRouteUrl = new URL(
  "../../../app/api/auth/send-verification-code/route.ts",
  import.meta.url,
)
const registerRouteUrl = new URL("../../../app/api/auth/register/route.ts", import.meta.url)
const registerEmailPolicyUrl = new URL(
  "../../../lib/auth/register-email-policy.ts",
  import.meta.url,
)
const errorKeysUrl = new URL("../../../lib/api/error-keys.ts", import.meta.url)
const zhDictUrl = new URL("../../../dictionaries/zh.json", import.meta.url)
const enDictUrl = new URL("../../../dictionaries/en.json", import.meta.url)
const migrationUrl = new URL(
  "../../../prisma/migrations/202603120002_add_register_qq_number_email_only/migration.sql",
  import.meta.url,
)

const schemaSource = readFileSync(schemaUrl, "utf8")
const siteSettingsSource = readFileSync(siteSettingsUrl, "utf8")
const adminSystemConfigRouteSource = readFileSync(adminSystemConfigRouteUrl, "utf8")
const publicSystemConfigRouteSource = readFileSync(publicSystemConfigRouteUrl, "utf8")
const adminSettingsFormSource = readFileSync(adminSettingsFormUrl, "utf8")
const registerFormSource = readFileSync(registerFormUrl, "utf8")
const sendCodeRouteSource = readFileSync(sendCodeRouteUrl, "utf8")
const registerRouteSource = readFileSync(registerRouteUrl, "utf8")
const registerEmailPolicySource = readIfExists(registerEmailPolicyUrl)
const errorKeysSource = readFileSync(errorKeysUrl, "utf8")
const zhDictSource = readFileSync(zhDictUrl, "utf8")
const enDictSource = readFileSync(enDictUrl, "utf8")

test("register qq email only flag is wired through schema, settings routes, and admin UI", () => {
  assert.equal(existsSync(migrationUrl), true)
  assert.match(schemaSource, /registerQqNumberEmailOnly\s+Boolean\s+@default\(false\)/)
  assert.match(siteSettingsSource, /registerQqNumberEmailOnly:\s*boolean/)
  assert.match(adminSystemConfigRouteSource, /registerQqNumberEmailOnly/)
  assert.match(publicSystemConfigRouteSource, /registerQqNumberEmailOnly/)
  assert.match(adminSettingsFormSource, /QQ号@qq\.com|registerQqNumberEmailOnly/)
})

test("register form can switch to qq-number-only mode", () => {
  assert.match(registerFormSource, /registerQqNumberEmailOnly/)
  assert.match(registerFormSource, /@qq\.com/)
  assert.match(zhDictSource, /QQ号|仅允许 QQ号@qq\.com/)
  assert.match(enDictSource, /QQ number|Only QQ number@qq\.com/)
})

test("register flows share qq-only email validation on the server", () => {
  assert.equal(existsSync(registerEmailPolicyUrl), true)
  assert.match(registerEmailPolicySource, /qq\.com/)
  assert.match(registerEmailPolicySource, /\^\\d\+\$/)
  assert.match(sendCodeRouteSource, /register-email-policy/)
  assert.match(registerRouteSource, /register-email-policy/)
  assert.match(errorKeysSource, /qqEmailOnly/)
})
