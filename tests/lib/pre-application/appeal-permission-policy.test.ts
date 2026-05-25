import test from "node:test"
import assert from "node:assert/strict"
import {
  PreApplicationAppealSource,
  PreApplicationAppealStatus,
  PreApplicationStatus,
} from "@prisma/client"

const preApplicationPolicy = await import(
  new URL("../../../lib/auth/policies/pre-application.ts", import.meta.url).href
)
const appealPolicy = await import(
  new URL("../../../lib/auth/policies/pre-application-appeal.ts", import.meta.url).href
)

const admin = { id: "admin_1", role: "ADMIN" as const }
const otherAdmin = { id: "admin_2", role: "ADMIN" as const }
const superAdmin = { id: "super_1", role: "SUPER_ADMIN" as const }

test("ordinary pre-application review remains ADMIN only", () => {
  assert.deepEqual(preApplicationPolicy.canReviewPreApplication(admin), {
    allowed: true,
    reason: null,
  })
  assert.deepEqual(preApplicationPolicy.canReviewPreApplication(superAdmin), {
    allowed: false,
    reason: "MISSING_CAPABILITY",
  })
})

test("archive policy allows admins unless pending appeals exist", () => {
  assert.deepEqual(
    preApplicationPolicy.canArchivePreApplication(admin, { pendingAppealCount: 0 }),
    { allowed: true, reason: null },
  )
  assert.deepEqual(
    preApplicationPolicy.canArchivePreApplication(superAdmin, { pendingAppealCount: 0 }),
    { allowed: true, reason: null },
  )
  assert.deepEqual(
    preApplicationPolicy.canArchivePreApplication(admin, { pendingAppealCount: 1 }),
    { allowed: false, reason: "PENDING_APPEAL_EXISTS" },
  )
})

test("appeal view is available to ADMIN and SUPER_ADMIN", () => {
  assert.equal(appealPolicy.canViewPreApplicationAppeals(admin), true)
  assert.equal(appealPolicy.canViewPreApplicationAppeals(superAdmin), true)
  assert.equal(appealPolicy.canViewPreApplicationAppeals({ id: "user_1", role: "USER" }), false)
})

test("appeal review allows another admin on a pending rejected application", () => {
  assert.deepEqual(
    appealPolicy.getPreApplicationAppealReviewPolicy({
      actor: otherAdmin,
      appeal: {
        status: PreApplicationAppealStatus.PENDING,
        source: PreApplicationAppealSource.USER_APPEAL,
        initiatedById: "user_1",
        preApplication: { status: PreApplicationStatus.REJECTED },
        rejectionReviewedById: admin.id,
      },
    }),
    { allowed: true, reason: null },
  )
})

test("appeal review blocks the original rejection reviewer", () => {
  assert.deepEqual(
    appealPolicy.getPreApplicationAppealReviewPolicy({
      actor: admin,
      appeal: {
        status: PreApplicationAppealStatus.PENDING,
        source: PreApplicationAppealSource.USER_APPEAL,
        initiatedById: "user_1",
        preApplication: { status: PreApplicationStatus.REJECTED },
        rejectionReviewedById: admin.id,
      },
    }),
    { allowed: false, reason: "ORIGINAL_REVIEWER" },
  )
})

test("appeal review blocks the admin review request initiator", () => {
  assert.deepEqual(
    appealPolicy.getPreApplicationAppealReviewPolicy({
      actor: admin,
      appeal: {
        status: PreApplicationAppealStatus.PENDING,
        source: PreApplicationAppealSource.ADMIN_REVIEW_REQUEST,
        initiatedById: admin.id,
        preApplication: { status: PreApplicationStatus.REJECTED },
        rejectionReviewedById: otherAdmin.id,
      },
    }),
    { allowed: false, reason: "REVIEW_REQUEST_INITIATOR" },
  )
})

test("appeal review rejects archived and already handled records", () => {
  assert.deepEqual(
    appealPolicy.getPreApplicationAppealReviewPolicy({
      actor: superAdmin,
      appeal: {
        status: PreApplicationAppealStatus.PENDING,
        source: PreApplicationAppealSource.USER_APPEAL,
        initiatedById: "user_1",
        preApplication: { status: PreApplicationStatus.ARCHIVED },
        rejectionReviewedById: admin.id,
      },
    }),
    { allowed: false, reason: "ARCHIVED_PRE_APPLICATION" },
  )
  assert.deepEqual(
    appealPolicy.getPreApplicationAppealReviewPolicy({
      actor: superAdmin,
      appeal: {
        status: PreApplicationAppealStatus.REJECTED,
        source: PreApplicationAppealSource.USER_APPEAL,
        initiatedById: "user_1",
        preApplication: { status: PreApplicationStatus.REJECTED },
        rejectionReviewedById: admin.id,
      },
    }),
    { allowed: false, reason: "APPEAL_ALREADY_REVIEWED" },
  )
})
