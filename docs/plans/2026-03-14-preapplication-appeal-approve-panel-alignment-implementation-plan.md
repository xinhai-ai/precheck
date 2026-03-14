# Pre-Application Appeal Approve Panel Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让管理端“预申请申诉通过”流程在字段、交互和持久化行为上对齐普通“预申请通过面板”，支持指导意见、邀请码输入与已发码状态，并将结果写回对应预申请。

**Architecture:** 先用一个定点源码回归测试锁定申诉通过的新输入契约、列表返回结构和 UI 关键交互，再分别修改申诉审核 API、申诉列表数据选择与管理端弹窗。实现时复用普通预申请通过的既有语义：邀请码仍作为可选文本追加到 `guidance` 中，`codeSent`/`codeSentAt` 作为单独状态写回 `PreApplication`，避免引入额外 schema 变更。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma, Zod, node:test, Sonner, Lucide, 现有 `lib/invite-code/utils.ts` 与公开邀请码检测接口

---

### Task 1: 锁定申诉通过后端契约回归测试

**Files:**
- Create: `tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
- Read: `app/api/admin/pre-application-appeals/[id]/review/route.ts`
- Read: `app/api/admin/pre-application-appeals/route.ts`
- Read: `lib/openapi-spec.ts`
- Read: `dictionaries/zh.json`
- Read: `dictionaries/en.json`

**Step 1: Write the failing test**

```ts
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const reviewRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/[id]/review/route.ts", import.meta.url),
  "utf8",
)
const listRouteSource = readFileSync(
  new URL("../../../app/api/admin/pre-application-appeals/route.ts", import.meta.url),
  "utf8",
)
const openApiSpecSource = readFileSync(new URL("../../../lib/openapi-spec.ts", import.meta.url), "utf8")
const zhDictionary = JSON.parse(readFileSync(new URL("../../../dictionaries/zh.json", import.meta.url), "utf8"))
const enDictionary = JSON.parse(readFileSync(new URL("../../../dictionaries/en.json", import.meta.url), "utf8"))

test("appeal approve route accepts guidance, inviteCode, and codeSent", () => {
  assert.match(reviewRouteSource, /guidance:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2000\)/)
  assert.match(reviewRouteSource, /inviteCode:\s*z\.string\(\)\.trim\(\)\.optional\(\)/)
  assert.match(reviewRouteSource, /codeSent:\s*z\.boolean\(\)\.optional\(\)/)
  assert.match(reviewRouteSource, /guidanceWithCode/)
})

test("appeal list route exposes approved pre-application invite status fields", () => {
  assert.match(listRouteSource, /codeSent:/)
  assert.match(listRouteSource, /codeSentAt:/)
  assert.match(listRouteSource, /inviteCode:/)
})

test("openapi and appeal page copy describe the aligned approve flow", () => {
  assert.match(openApiSpecSource, /guidance: \{ type: "string", minLength: 1, maxLength: 2000 \}/)
  assert.match(openApiSpecSource, /inviteCode: \{ type: "string" \}/)
  assert.match(openApiSpecSource, /codeSent: \{ type: "boolean" \}/)
  assert.equal(zhDictionary.admin.preApplicationAppealsPage.dialog.overrideDescription, "填写指导意见后将直接通过该预申请，不再回到待审核列表。")
  assert.equal(enDictionary.admin.preApplicationAppealsPage.messages.commentRequired, "Guidance is required")
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: FAIL with missing `guidance`, `inviteCode`, `codeSent`, or outdated approve-copy assertions.

**Step 3: Write minimal implementation**

- 在 `app/api/admin/pre-application-appeals/[id]/review/route.ts` 的 schema 中加入 `guidance`、`inviteCode`、`codeSent`。
- 对 `APPROVE` 分支新增 approve 专属字段解析：

```ts
const rawGuidance =
  action === "APPROVE"
    ? parsed.data.guidance?.trim()
    : parsed.data.reviewComment.trim()

if (!rawGuidance) {
  return createApiErrorResponse(request, ApiErrorKeys.general.invalid, {
    status: 400,
    meta: { detail: "指导意见不能为空" },
  })
}

const inviteCode = parsed.data.inviteCode?.trim()
const guidanceWithCode =
  action === "APPROVE" && inviteCode
    ? `${rawGuidance}\n\n${dict.preApplication.notifications.inviteCodeLabel ?? "邀请码："}${inviteCode}`
    : rawGuidance
```

- 在 `APPROVE` 分支写回 `PreApplication` 时同步设置：

```ts
...(inviteCode || parsed.data.codeSent ? { codeSent: true, codeSentAt: now } : {})
```

- 在 `app/api/admin/pre-application-appeals/route.ts` 的 `preApplication.select` 中加入：

```ts
inviteCode: { select: { id: true, code: true, expiresAt: true, usedAt: true } },
codeSent: true,
codeSentAt: true,
```

- 在 `lib/openapi-spec.ts` 中把 `/admin/pre-application-appeals/{id}/review` 的请求体更新为允许 `guidance`、`inviteCode`、`codeSent`，并把说明文案改为 approve guidance 语义。
- 在 `dictionaries/zh.json` / `dictionaries/en.json` 中，把申诉通过相关 copy 从 “Review Comment” 调整为 “Guidance” 语义，至少覆盖：
  - `admin.preApplicationAppealsPage.dialog.overrideDescription`
  - `admin.preApplicationAppealsPage.messages.commentRequired`

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/lib/pre-application/appeal-approve-panel-alignment.test.ts \
  app/api/admin/pre-application-appeals/[id]/review/route.ts \
  app/api/admin/pre-application-appeals/route.ts \
  lib/openapi-spec.ts \
  dictionaries/zh.json \
  dictionaries/en.json
git commit -m "feat: align appeal approve backend contract"
```

### Task 2: 让申诉通过 API 与普通预申请通过语义一致

**Files:**
- Modify: `app/api/admin/pre-application-appeals/[id]/review/route.ts`
- Read: `app/api/admin/pre-applications/[id]/review/route.ts`
- Read: `lib/email/templates.ts`
- Read: `lib/pre-application/notifications.ts`

**Step 1: Write the failing test**

在 `tests/lib/pre-application/appeal-approve-panel-alignment.test.ts` 追加一条后端语义测试，要求申诉通过分支：

```ts
test("appeal approve path writes guidanceWithCode and codeSent metadata", () => {
  assert.match(reviewRouteSource, /const rawGuidance =/)
  assert.match(reviewRouteSource, /const guidanceWithCode =/)
  assert.match(reviewRouteSource, /reviewComment:\s*rawGuidance|reviewComment:\s*guidanceWithCode/)
  assert.match(reviewRouteSource, /guidance:\s*guidanceWithCode/)
  assert.match(reviewRouteSource, /codeSentAt: now|codeSentAt: new Date\(\)/)
  assert.match(reviewRouteSource, /metadata:\s*\{[\s\S]*inviteCode[\s\S]*codeSent/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: FAIL because the approve branch still only uses `reviewComment` semantics.

**Step 3: Write minimal implementation**

- 参考 `app/api/admin/pre-applications/[id]/review/route.ts` 的 approve 逻辑，不新增 schema 字段，也不引入新的邀请码关联表写法。
- 在申诉通过分支中统一使用：
  - `rawGuidance` 作为审核留痕文本
  - `guidanceWithCode` 作为写回 `PreApplication.guidance`、站内信和邮件的最终文案
- 更新申诉记录：

```ts
reviewComment: rawGuidance
```

- 更新目标预申请：

```ts
data: {
  status: PreApplicationStatus.APPROVED,
  guidance: guidanceWithCode,
  reviewedAt: now,
  reviewedById: user.id,
  version: nextVersion,
  ...((inviteCode || codeSent) ? { codeSent: true, codeSentAt: now } : {}),
}
```

- 更新版本记录 `preApplicationVersion.create` 中的 `guidance` 为 `guidanceWithCode`。
- 调整站内信与邮件 builder 调用，传入 `guidanceWithCode`，确保通知与落库结果一致。
- 审计日志元数据显式记录 `guidance`、`inviteCode`、`codeSent`。

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/lib/pre-application/appeal-approve-panel-alignment.test.ts \
  app/api/admin/pre-application-appeals/[id]/review/route.ts
git commit -m "feat: align appeal approval persistence"
```

### Task 3: 锁定申诉通过弹窗与查看态的前端回归测试

**Files:**
- Modify: `tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
- Read: `components/admin/pre-application-appeals-table.tsx`
- Read: `lib/invite-code/utils.ts`

**Step 1: Write the failing test**

在同一测试文件中追加前端源码断言，锁定新的 state、payload 与展示结构：

```ts
const componentSource = readFileSync(
  new URL("../../../components/admin/pre-application-appeals-table.tsx", import.meta.url),
  "utf8",
)

test("appeal approve dialog reuses invite code and code-sent controls", () => {
  assert.match(componentSource, /const \[guidance, setGuidance\] = useState\(""\)/)
  assert.match(componentSource, /const \[inviteCode, setInviteCode\] = useState\(""\)/)
  assert.match(componentSource, /const \[markCodeSent, setMarkCodeSent\] = useState\(false\)/)
  assert.match(componentSource, /const \[inviteCodeCheckResult, setInviteCodeCheckResult\]/)
  assert.match(componentSource, /extractPureCode/)
  assert.match(componentSource, /payload:\s*\{[\s\S]*guidance[\s\S]*inviteCode[\s\S]*codeSent/)
})

test("appeal view mode shows approved guidance and invite status", () => {
  assert.match(componentSource, /reviewDialog\.appeal\.preApplication\.codeSent/)
  assert.match(componentSource, /inviteStatusIssued|inviteStatusNone/)
  assert.match(componentSource, /reviewDialog\.appeal\.preApplication\.guidance/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: FAIL because the component still only manages `reviewComment`.

**Step 3: Write minimal implementation**

- 在 `components/admin/pre-application-appeals-table.tsx` 中新增并重置以下 state：

```ts
const [guidance, setGuidance] = useState("")
const [inviteCode, setInviteCode] = useState("")
const [markCodeSent, setMarkCodeSent] = useState(false)
const [inviteCodeChecking, setInviteCodeChecking] = useState(false)
const [inviteCodeCheckResult, setInviteCodeCheckResult] = useState<...>(null)
```

- `openReviewDialog()` 中：
  - `REJECT` 模式继续清空并使用 `reviewComment`
  - `APPROVE` 模式从 `appeal.preApplication.guidance`、`appeal.preApplication.codeSent` 预填对应 state
- 提取 `checkInviteCodeValidity()`，直接复用普通预申请面板的现有检查逻辑：
  - 使用 `extractPureCode()`
  - 调用 `/api/public/check-invite-codes`
- `submitReview()` 中按模式构造 payload：

```ts
body: JSON.stringify({
  action: reviewDialog.mode,
  ...(reviewDialog.mode === "APPROVE"
    ? {
        guidance,
        inviteCode: inviteCode.trim() || undefined,
        codeSent: !!inviteCode.trim() || markCodeSent,
      }
    : {
        reviewComment: reviewComment.trim(),
        applySubmitBan,
        submitBanDays: applySubmitBan ? nextSubmitBanDays : undefined,
      }),
  locale,
})
```

- `APPROVE` 模式的表单结构改成与普通预申请通过面板相近：
  - 邀请码输入框
  - 检测按钮与检测结果提示
  - `已发码` 复选框
  - 指导意见文本框
- `VIEW` 模式中，当记录为 `OVERRIDDEN` 时展示：
  - `preApplication.codeSent`
  - `preApplication.inviteCode`（如存在）
  - `preApplication.guidance`
  - 同时保留申诉理由与驳回快照

**Step 4: Run test to verify it passes**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/lib/pre-application/appeal-approve-panel-alignment.test.ts \
  components/admin/pre-application-appeals-table.tsx
git commit -m "feat: align appeal approve dialog"
```

### Task 4: 做定点验证并清理交付面

**Files:**
- Read: `tests/lib/pre-application/appeal-approve-panel-alignment.test.ts`
- Read: `components/admin/pre-application-appeals-table.tsx`
- Read: `app/api/admin/pre-application-appeals/[id]/review/route.ts`

**Step 1: Run the focused regression suite**

Run: `node --test tests/lib/pre-application/appeal-approve-panel-alignment.test.ts tests/lib/pre-application/appeal-utils.test.ts tests/lib/pre-application/appeal-review-email.test.ts`
Expected: PASS

**Step 2: Run type checking**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run lint if typecheck passes cleanly**

Run: `pnpm lint`
Expected: PASS

**Step 4: Review the changed files for accidental drift**

确认只涉及本需求相关文件：

```bash
git diff --stat
```

Expected: 仅出现申诉审核组件、申诉审核 API、申诉列表 API、OpenAPI、字典和测试文件。

**Step 5: Commit the verification-safe batch**

```bash
git add tests/lib/pre-application/appeal-approve-panel-alignment.test.ts \
  components/admin/pre-application-appeals-table.tsx \
  app/api/admin/pre-application-appeals/[id]/review/route.ts \
  app/api/admin/pre-application-appeals/route.ts \
  lib/openapi-spec.ts \
  dictionaries/zh.json \
  dictionaries/en.json
git commit -m "feat: align appeal approval flow"
```
