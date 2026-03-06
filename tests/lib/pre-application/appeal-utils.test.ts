import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const {
  PRE_APPLICATION_APPEAL_COOLDOWN_DAYS,
  PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS,
  getAppealCooldownRemainingSeconds,
  getAppealRejectionSnapshot,
  getAppealRejectSubmitBanUntil,
  getPreApplicationAppealAvailability,
} = await import(new URL("../../../lib/pre-application/appeal-utils.ts", import.meta.url).href)
const { ApiErrorKeys } = await import(
  new URL("../../../lib/api/error-keys.ts", import.meta.url).href
)
const { openApiSpec } = await import(new URL("../../../lib/openapi-spec.ts", import.meta.url).href)

const enDictionary = JSON.parse(
  readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8"),
) as Record<string, any>
const zhDictionary = JSON.parse(
  readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8"),
) as Record<string, any>

test("appeal cooldown stays at 3 days and reject submit ban is 7 days", () => {
  assert.equal(PRE_APPLICATION_APPEAL_COOLDOWN_DAYS, 3)
  assert.equal(PRE_APPLICATION_APPEAL_SUBMIT_BAN_DAYS, 7)
})

test("getAppealCooldownRemainingSeconds returns ceiling seconds and never negative", () => {
  const now = new Date("2026-03-05T12:29:49.900Z")
  const lastAppealedAt = new Date("2026-03-02T12:30:00.000Z")

  assert.equal(getAppealCooldownRemainingSeconds(lastAppealedAt, now), 11)
  assert.equal(
    getAppealCooldownRemainingSeconds(
      new Date("2026-03-02T12:30:00.000Z"),
      new Date("2026-03-05T12:30:00.000Z"),
    ),
    0,
  )
})

test("getAppealCooldownRemainingSeconds returns 0 for missing values", () => {
  const now = new Date("2026-03-05T12:30:00.000Z")

  assert.equal(getAppealCooldownRemainingSeconds(null, now), 0)
  assert.equal(getAppealCooldownRemainingSeconds(undefined, now), 0)
})

test("getAppealCooldownRemainingSeconds throws on invalid date input", () => {
  const now = new Date("2026-03-05T12:30:00.000Z")

  assert.throws(
    () => getAppealCooldownRemainingSeconds("not-a-date", now),
    /Invalid appeal createdAt/,
  )
  assert.throws(
    () => getAppealCooldownRemainingSeconds(new Date("invalid"), now),
    /Invalid appeal createdAt/,
  )
})

test("getPreApplicationAppealAvailability reports APPEAL_DISABLED", () => {
  assert.deepEqual(
    getPreApplicationAppealAvailability({
      appealEnabled: false,
      preApplicationStatus: "REJECTED",
      hasPendingAppeal: false,
      lastAppealCreatedAt: null,
    }),
    {
      canCreate: false,
      reason: "APPEAL_DISABLED",
      cooldownRemainingSeconds: 0,
    },
  )
})

test("getPreApplicationAppealAvailability reports PRE_APPLICATION_NOT_REJECTED", () => {
  assert.deepEqual(
    getPreApplicationAppealAvailability({
      appealEnabled: true,
      preApplicationStatus: "PENDING",
      hasPendingAppeal: false,
      lastAppealCreatedAt: null,
    }),
    {
      canCreate: false,
      reason: "PRE_APPLICATION_NOT_REJECTED",
      cooldownRemainingSeconds: 0,
    },
  )
})

test("getPreApplicationAppealAvailability reports PENDING_APPEAL_EXISTS", () => {
  assert.deepEqual(
    getPreApplicationAppealAvailability({
      appealEnabled: true,
      preApplicationStatus: "REJECTED",
      hasPendingAppeal: true,
      lastAppealCreatedAt: null,
    }),
    {
      canCreate: false,
      reason: "PENDING_APPEAL_EXISTS",
      cooldownRemainingSeconds: 0,
    },
  )
})

test("getPreApplicationAppealAvailability reports APPEAL_COOLDOWN_ACTIVE", () => {
  const now = new Date("2026-03-05T12:29:49.900Z")

  assert.deepEqual(
    getPreApplicationAppealAvailability({
      appealEnabled: true,
      preApplicationStatus: "REJECTED",
      hasPendingAppeal: false,
      lastAppealCreatedAt: new Date("2026-03-02T12:30:00.000Z"),
      now,
    }),
    {
      canCreate: false,
      reason: "APPEAL_COOLDOWN_ACTIVE",
      cooldownRemainingSeconds: 11,
    },
  )
})

test("getPreApplicationAppealAvailability throws on invalid lastAppealCreatedAt", () => {
  assert.throws(
    () =>
      getPreApplicationAppealAvailability({
        appealEnabled: true,
        preApplicationStatus: "REJECTED",
        hasPendingAppeal: false,
        lastAppealCreatedAt: "not-a-date",
      }),
    /Invalid appeal createdAt/,
  )
})

test("getPreApplicationAppealAvailability allows appeal when all checks pass", () => {
  assert.deepEqual(
    getPreApplicationAppealAvailability({
      appealEnabled: true,
      preApplicationStatus: "REJECTED",
      hasPendingAppeal: false,
      lastAppealCreatedAt: null,
    }),
    {
      canCreate: true,
      reason: null,
      cooldownRemainingSeconds: 0,
    },
  )
})

test("getAppealRejectSubmitBanUntil keeps a later existing ban", () => {
  const now = new Date("2026-03-06T00:00:00.000Z")

  assert.deepEqual(
    getAppealRejectSubmitBanUntil(new Date("2026-03-20T00:00:00.000Z"), now),
    new Date("2026-03-20T00:00:00.000Z"),
  )
})

test("getAppealRejectSubmitBanUntil extends shorter or missing bans to 7 days", () => {
  const now = new Date("2026-03-06T00:00:00.000Z")
  const expected = new Date("2026-03-13T00:00:00.000Z")

  assert.deepEqual(getAppealRejectSubmitBanUntil(null, now), expected)
  assert.deepEqual(
    getAppealRejectSubmitBanUntil(new Date("2026-03-07T00:00:00.000Z"), now),
    expected,
  )
})

test("getAppealRejectionSnapshot selects the rejected version tied to the appeal", () => {
  const matchedReviewer = {
    id: "admin-1",
    name: "Matched Reviewer",
    email: "matched@example.com",
  }

  assert.deepEqual(
    getAppealRejectionSnapshot({
      appealCreatedAt: new Date("2026-03-03T10:00:00.000Z"),
      preApplication: {
        status: "REJECTED",
        essay: "current essay",
        guidance: "current guidance",
        reviewedAt: new Date("2026-03-05T08:00:00.000Z"),
        reviewedBy: {
          id: "admin-2",
          name: "Later Reviewer",
          email: "later@example.com",
        },
      },
      versions: [
        {
          status: "REJECTED",
          essay: "later rejected essay",
          guidance: "later rejected guidance",
          reviewedAt: new Date("2026-03-05T08:00:00.000Z"),
          reviewedBy: {
            id: "admin-2",
            name: "Later Reviewer",
            email: "later@example.com",
          },
          createdAt: new Date("2026-03-05T08:00:00.000Z"),
        },
        {
          status: "PENDING",
          essay: "pending essay",
          guidance: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: new Date("2026-03-01T08:00:00.000Z"),
        },
        {
          status: "REJECTED",
          essay: "matched rejected essay",
          guidance: "matched rejected guidance",
          reviewedAt: new Date("2026-03-02T12:00:00.000Z"),
          reviewedBy: matchedReviewer,
          createdAt: new Date("2026-03-02T12:00:00.000Z"),
        },
      ],
    }),
    {
      essay: "matched rejected essay",
      guidance: "matched rejected guidance",
      reviewedAt: new Date("2026-03-02T12:00:00.000Z"),
      reviewedBy: matchedReviewer,
    },
  )
})

test("getAppealRejectionSnapshot falls back to current rejected record when needed", () => {
  const currentReviewer = {
    id: "admin-3",
    name: "Current Reviewer",
    email: "current@example.com",
  }

  assert.deepEqual(
    getAppealRejectionSnapshot({
      appealCreatedAt: new Date("2026-03-03T10:00:00.000Z"),
      preApplication: {
        status: "REJECTED",
        essay: "current rejected essay",
        guidance: "current rejected guidance",
        reviewedAt: new Date("2026-03-02T09:00:00.000Z"),
        reviewedBy: currentReviewer,
      },
      versions: [
        {
          status: "PENDING",
          essay: "pending essay",
          guidance: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: new Date("2026-03-01T08:00:00.000Z"),
        },
      ],
    }),
    {
      essay: "current rejected essay",
      guidance: "current rejected guidance",
      reviewedAt: new Date("2026-03-02T09:00:00.000Z"),
      reviewedBy: currentReviewer,
    },
  )
})

test("getAppealRejectionSnapshot returns null when no matching rejection exists", () => {
  assert.equal(
    getAppealRejectionSnapshot({
      appealCreatedAt: new Date("2026-03-03T10:00:00.000Z"),
      preApplication: {
        status: "PENDING",
        essay: "current pending essay",
        guidance: null,
        reviewedAt: null,
        reviewedBy: null,
      },
      versions: [
        {
          status: "REJECTED",
          essay: "future rejected essay",
          guidance: "future rejected guidance",
          reviewedAt: new Date("2026-03-05T08:00:00.000Z"),
          reviewedBy: {
            id: "admin-4",
            name: "Future Reviewer",
            email: "future@example.com",
          },
          createdAt: new Date("2026-03-05T08:00:00.000Z"),
        },
      ],
    }),
    null,
  )
})

test("appeal error keys are exposed under preApplication.appeal", () => {
  assert.deepEqual(ApiErrorKeys.preApplication.appeal, {
    failedToFetch: "apiErrors.preApplication.appeal.failedToFetch",
    failedToCreate: "apiErrors.preApplication.appeal.failedToCreate",
    disabled: "apiErrors.preApplication.appeal.disabled",
    preApplicationNotRejected: "apiErrors.preApplication.appeal.preApplicationNotRejected",
    pendingAppealExists: "apiErrors.preApplication.appeal.pendingAppealExists",
    cooldownActive: "apiErrors.preApplication.appeal.cooldownActive",
  })
})

test("appeal error keys are localized in both dictionaries", () => {
  assert.equal(
    enDictionary.apiErrors.preApplication.appeal.pendingAppealExists,
    "There is already a pending appeal for this pre-application",
  )
  assert.equal(
    zhDictionary.apiErrors.preApplication.appeal.pendingAppealExists,
    "该预申请已有待处理的复审请求",
  )
})

test("admin appeal error keys are exposed under admin.preApplicationAppeals", () => {
  assert.deepEqual(ApiErrorKeys.admin.preApplicationAppeals, {
    failedToFetch: "apiErrors.admin.preApplicationAppeals.failedToFetch",
    failedToReview: "apiErrors.admin.preApplicationAppeals.failedToReview",
    notFound: "apiErrors.admin.preApplicationAppeals.notFound",
    alreadyReviewed: "apiErrors.admin.preApplicationAppeals.alreadyReviewed",
    invalidAction: "apiErrors.admin.preApplicationAppeals.invalidAction",
    targetChanged: "apiErrors.admin.preApplicationAppeals.targetChanged",
  })
})

test("admin appeal error keys are localized in both dictionaries", () => {
  assert.equal(
    enDictionary.apiErrors.admin.preApplicationAppeals.alreadyReviewed,
    "This appeal has already been reviewed",
  )
  assert.equal(zhDictionary.apiErrors.admin.preApplicationAppeals.alreadyReviewed, "该申诉已处理")
  assert.equal(
    enDictionary.apiErrors.admin.preApplicationAppeals.targetChanged,
    "The appealed pre-application has changed and can no longer be reopened",
  )
  assert.equal(
    zhDictionary.apiErrors.admin.preApplicationAppeals.targetChanged,
    "该申诉对应的预申请状态已变化，无法恢复到待审核",
  )
})

test("appeal review inbox messages are localized in both dictionaries", () => {
  assert.equal(
    enDictionary.preApplication.notifications.appealReview.rejectedTitle,
    "Pre-application appeal rejected",
  )
  assert.equal(
    zhDictionary.preApplication.notifications.appealReview.overriddenIntro,
    "你的预申请申诉已通过，原预申请已直接通过。",
  )
})

test("admin pre-application appeal page uses approve wording in both dictionaries", () => {
  assert.equal(enDictionary.admin.preApplicationAppealsPage.filters.overridden, "Approved")
  assert.equal(zhDictionary.admin.preApplicationAppealsPage.filters.overridden, "已通过")
  assert.equal(enDictionary.admin.preApplicationAppealsPage.actions.override, "Approve")
  assert.equal(zhDictionary.admin.preApplicationAppealsPage.actions.override, "通过申请")
  assert.equal(
    enDictionary.admin.preApplicationAppealsPage.messages.overridden,
    "Pre-application approved",
  )
  assert.equal(zhDictionary.admin.preApplicationAppealsPage.messages.overridden, "已通过申请")
})

test("openApiSpec documents /pre-application/appeal GET and POST", () => {
  const appealPath = openApiSpec.paths["/pre-application/appeal"]

  assert.ok(appealPath)
  assert.equal(appealPath.get?.summary, "获取当前用户最新预申请的申诉信息")
  assert.equal(appealPath.post?.summary, "提交预申请申诉")
  assert.deepEqual(appealPath.post?.requestBody?.content?.["application/json"]?.schema?.required, [
    "preApplicationId",
    "reason",
  ])
})

test("openApiSpec documents admin pre-application appeal queue and review routes", () => {
  const queuePath = openApiSpec.paths["/admin/pre-application-appeals"]
  const reviewPath = openApiSpec.paths["/admin/pre-application-appeals/{id}/review"]

  assert.ok(queuePath)
  assert.equal(queuePath.get?.summary, "预申请申诉队列")
  assert.equal(reviewPath.post?.summary, "审核预申请申诉")
  assert.deepEqual(
    reviewPath.post?.requestBody?.content?.["application/json"]?.schema?.properties?.action?.enum,
    ["REJECT", "APPROVE"],
  )
})
