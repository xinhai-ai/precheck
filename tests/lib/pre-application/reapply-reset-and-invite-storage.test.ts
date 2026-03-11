import test from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

function readIfExists(fileUrl: URL) {
  return existsSync(fileUrl) ? readFileSync(fileUrl, "utf8") : ""
}

const schemaUrl = new URL("../../../prisma/schema.prisma", import.meta.url)
const usersTableUrl = new URL("../../../components/admin/users-table.tsx", import.meta.url)
const preApplicationRouteUrl = new URL("../../../app/api/pre-application/route.ts", import.meta.url)
const preApplicationFormUrl = new URL(
  "../../../components/dashboard/pre-application-form.tsx",
  import.meta.url,
)
const adminReviewTableUrl = new URL(
  "../../../components/admin/pre-applications-table.tsx",
  import.meta.url,
)
const adminDashboardUrl = new URL("../../../components/admin/admin-dashboard.tsx", import.meta.url)
const adminDashboardRouteUrl = new URL("../../../app/api/admin/dashboard/route.ts", import.meta.url)
const adminReapplyRouteUrl = new URL(
  "../../../app/api/admin/users/[id]/reapply/route.ts",
  import.meta.url,
)
const reapplyStartRouteUrl = new URL(
  "../../../app/api/pre-application/reapply/start/route.ts",
  import.meta.url,
)
const claimCodeRouteUrl = new URL(
  "../../../app/api/pre-application/claim-code/route.ts",
  import.meta.url,
)
const adminInviteCodesPageUrl = new URL(
  "../../../app/[locale]/admin/invite-codes/page.tsx",
  import.meta.url,
)
const dashboardContributePageUrl = new URL(
  "../../../app/[locale]/dashboard/contribute/page.tsx",
  import.meta.url,
)
const adminInviteCodesRouteUrl = new URL("../../../app/api/admin/invite-codes/route.ts", import.meta.url)
const inviteCodeClientUrl = new URL("../../../lib/invite-code/client.ts", import.meta.url)
const permissionsUrl = new URL("../../../lib/auth/permissions.ts", import.meta.url)
const openApiSpecUrl = new URL("../../../lib/openapi-spec.ts", import.meta.url)
const systemStatsRouteUrl = new URL("../../../app/api/system-stats/route.ts", import.meta.url)
const statsBannerUrl = new URL("../../../components/sections/stats-banner.tsx", import.meta.url)

const schemaSource = readFileSync(schemaUrl, "utf8")
const usersTableSource = readFileSync(usersTableUrl, "utf8")
const preApplicationRouteSource = readFileSync(preApplicationRouteUrl, "utf8")
const preApplicationFormSource = readFileSync(preApplicationFormUrl, "utf8")
const adminReviewTableSource = readFileSync(adminReviewTableUrl, "utf8")
const adminDashboardSource = readFileSync(adminDashboardUrl, "utf8")
const adminDashboardRouteSource = readFileSync(adminDashboardRouteUrl, "utf8")
const adminReapplyRouteSource = readIfExists(adminReapplyRouteUrl)
const reapplyStartRouteSource = readIfExists(reapplyStartRouteUrl)
const permissionsSource = readFileSync(permissionsUrl, "utf8")
const openApiSpecSource = readFileSync(openApiSpecUrl, "utf8")
const systemStatsRouteSource = readFileSync(systemStatsRouteUrl, "utf8")
const statsBannerSource = readFileSync(statsBannerUrl, "utf8")

test("user schema supports approved-user reapply state", () => {
  assert.match(schemaSource, /preApplicationReapplyEligibleAt\s+DateTime\?/) 
  assert.match(schemaSource, /preApplicationReapplyStartedAt\s+DateTime\?/) 
})

test("super-admin user management exposes a reset-to-reapply action", () => {
  assert.equal(existsSync(adminReapplyRouteUrl), true)
  assert.match(adminReapplyRouteSource, /PreApplicationStatus\.APPROVED/)
  assert.match(adminReapplyRouteSource, /PreApplicationStatus\.ARCHIVED/)
  assert.match(adminReapplyRouteSource, /preApplicationReapplyEligibleAt/)
  assert.match(usersTableSource, /reapply/i)
  assert.match(usersTableSource, /\/api\/admin\/users\//)
})

test("pre-application API exposes reapply status and start endpoint", () => {
  assert.equal(existsSync(reapplyStartRouteUrl), true)
  assert.match(reapplyStartRouteSource, /preApplicationReapplyStartedAt/)
  assert.match(preApplicationRouteSource, /reapply:/)
  assert.match(preApplicationFormSource, /\/api\/pre-application\/reapply\/start/)
  assert.match(preApplicationFormSource, /startNewApplication|startNewRound|开始新申请/)
})

test("invite-code storage runtime pages and claim route are removed", () => {
  assert.equal(existsSync(claimCodeRouteUrl), false)
  assert.equal(existsSync(adminInviteCodesPageUrl), false)
  assert.equal(existsSync(dashboardContributePageUrl), false)
  assert.equal(existsSync(adminInviteCodesRouteUrl), false)
  assert.equal(existsSync(inviteCodeClientUrl), false)
})

test("admin review keeps manual invite checking but no longer loads stored invite options", () => {
  assert.match(adminReviewTableSource, /\/api\/public\/check-invite-codes/)
  assert.doesNotMatch(adminReviewTableSource, /\/api\/admin\/invite-codes\?/) 
  assert.doesNotMatch(adminReviewTableSource, /inviteCodeStorageEnabled/) 
})

test("admin dashboard and docs no longer depend on stored invite-code management", () => {
  assert.doesNotMatch(adminDashboardSource, /\/api\/admin\/invite-codes/)
  assert.doesNotMatch(adminDashboardRouteSource, /db\.inviteCode/)
  assert.doesNotMatch(adminDashboardRouteSource, /invite[A-Z][A-Za-z]+Count/)
  assert.doesNotMatch(permissionsSource, /invite-codes:delete/)
  assert.doesNotMatch(openApiSpecSource, /"\/admin\/invite-codes"/)
})

test("public stats no longer expose stored invite-code inventory", () => {
  assert.doesNotMatch(systemStatsRouteSource, /invite_codes_count/)
  assert.doesNotMatch(systemStatsRouteSource, /db\.inviteCode/)
  assert.doesNotMatch(statsBannerSource, /invite_codes_count/)
  assert.doesNotMatch(statsBannerSource, /Invite Codes|邀请码/)
})
