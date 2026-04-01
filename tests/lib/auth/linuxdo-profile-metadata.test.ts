import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

const schemaUrl = new URL("../../../prisma/schema.prisma", import.meta.url)
const migrationUrl = new URL(
  "../../../prisma/migrations/202604010001_add_account_provider_profile/migration.sql",
  import.meta.url,
)
const bootstrapSqlUrl = new URL("../../../scripts/001-create-auth-tables.sql", import.meta.url)
const oauthUrl = new URL("../../../lib/auth/oauth.ts", import.meta.url)
const usersRouteUrl = new URL("../../../app/api/admin/users/route.ts", import.meta.url)
const userDetailRouteUrl = new URL("../../../app/api/admin/users/[id]/route.ts", import.meta.url)
const usersTableUrl = new URL("../../../components/admin/users-table.tsx", import.meta.url)
const zhDictUrl = new URL("../../../dictionaries/zh.json", import.meta.url)
const enDictUrl = new URL("../../../dictionaries/en.json", import.meta.url)

const schemaSource = readFileSync(schemaUrl, "utf8")
const migrationSource = readIfExists(migrationUrl)
const bootstrapSqlSource = readFileSync(bootstrapSqlUrl, "utf8")
const oauthSource = readFileSync(oauthUrl, "utf8")
const usersRouteSource = readFileSync(usersRouteUrl, "utf8")
const userDetailRouteSource = readFileSync(userDetailRouteUrl, "utf8")
const usersTableSource = readFileSync(usersTableUrl, "utf8")
const zhDictSource = readFileSync(zhDictUrl, "utf8")
const enDictSource = readFileSync(enDictUrl, "utf8")

test("account schema persists provider profile snapshots", () => {
  assert.match(schemaSource, /providerProfile\s+Json\?/)
  assert.equal(existsSync(migrationUrl), true)
  assert.match(migrationSource, /ALTER TABLE "Account"[\s\S]*ADD COLUMN "providerProfile" JSONB/)
  assert.match(bootstrapSqlSource, /"providerProfile"\s+JSONB/)
})

test("linuxdo oauth keeps username and stores normalized profile snapshots", () => {
  assert.match(oauthSource, /username\?:\s*string/)
  assert.match(oauthSource, /linuxdoProfile\?:\s*\{/)
  assert.match(oauthSource, /username:\s*userData\.username/)
  assert.match(oauthSource, /linuxdoProfile:\s*\{/)
  assert.match(
    oauthSource,
    /name:\s*provider\s*===\s*"linuxdo"\s*\?\s*\(?profile\.username\s*\?\?\s*profile\.name\)?\s*:\s*profile\.name/,
  )
  assert.match(
    oauthSource,
    /providerProfile:\s*provider\s*===\s*"linuxdo"\s*\?\s*profile\.linuxdoProfile\s*:\s*undefined/,
  )
})

test("super-admin user apis expose linuxdo metadata visibility fields", () => {
  assert.match(usersRouteSource, /accounts:\s*\{[\s\S]*where:\s*\{\s*provider:\s*"linuxdo"\s*\}/)
  assert.match(usersRouteSource, /hasLinuxdoAccount:\s*Boolean\(/)
  assert.match(userDetailRouteSource, /linuxdoAccount:/)
  assert.match(userDetailRouteSource, /providerProfile:\s*true/)
  assert.match(userDetailRouteSource, /trustLevel:\s*true/)
})

test("super-admin users table exposes linuxdo metadata dialog", () => {
  assert.match(usersTableSource, /hasLinuxdoAccount\?:\s*boolean/)
  assert.match(usersTableSource, /linuxdoDetailOpen|linuxdoInfoDialogOpen/)
  assert.match(usersTableSource, /selectedLinuxdo(User|Detail)/)
  assert.match(usersTableSource, /fetch\(`\/api\/admin\/users\/\$\{id\}`\)/)
  assert.match(usersTableSource, /linuxdoAccount\?\.providerProfile/)
  assert.match(zhDictSource, /查看 Linux\.do 信息|Linux\.do 元信息/)
  assert.match(enDictSource, /View Linux\.do Profile|Linux\.do Metadata/)
})
