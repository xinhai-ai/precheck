import test from "node:test"
import assert from "node:assert/strict"

const {
  DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH,
  normalizePreApplicationDraftPayload,
  isPreApplicationDraftEssayTooLong,
} = await import(new URL("../../../lib/pre-application/draft-utils.ts", import.meta.url).href)

test("normalizePreApplicationDraftPayload trims text fields", () => {
  const normalized = normalizePreApplicationDraftPayload({
    essay: "  hello world  ",
    source: "OTHER",
    sourceDetail: "  from friend  ",
    registerEmail: "  user@example.com  ",
    group: "  GROUP_ONE  ",
  })

  assert.deepEqual(normalized, {
    essay: "hello world",
    source: "OTHER",
    sourceDetail: "from friend",
    registerEmail: "user@example.com",
    group: "GROUP_ONE",
  })
})

test("normalizePreApplicationDraftPayload allows incomplete payload", () => {
  const normalized = normalizePreApplicationDraftPayload({
    essay: null,
    source: null,
    sourceDetail: null,
    registerEmail: undefined,
    group: undefined,
  })

  assert.deepEqual(normalized, {
    essay: "",
    source: null,
    sourceDetail: null,
    registerEmail: "",
    group: "",
  })
})

test("normalizePreApplicationDraftPayload clears sourceDetail for non-OTHER source", () => {
  const normalized = normalizePreApplicationDraftPayload({
    essay: "test",
    source: "TIEBA",
    sourceDetail: "should be ignored",
    registerEmail: "a@b.com",
    group: "GROUP_ONE",
  })

  assert.equal(normalized.sourceDetail, null)
})

test("isPreApplicationDraftEssayTooLong rejects essay above max length", () => {
  const essay = "x".repeat(DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH + 1)
  assert.equal(
    isPreApplicationDraftEssayTooLong(essay, DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH),
    true,
  )
})

test("isPreApplicationDraftEssayTooLong accepts essay within max length", () => {
  const essay = "x".repeat(DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH)
  assert.equal(
    isPreApplicationDraftEssayTooLong(essay, DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH),
    false,
  )
})

test("isPreApplicationDraftEssayTooLong falls back to default max when limit is invalid", () => {
  const essay = "x".repeat(DEFAULT_PRE_APPLICATION_DRAFT_ESSAY_MAX_LENGTH + 1)
  assert.equal(isPreApplicationDraftEssayTooLong(essay, 0), true)
  assert.equal(isPreApplicationDraftEssayTooLong(essay, Number.NaN), true)
})
