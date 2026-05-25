# 预申请申诉权限体系设计

## 背景

当前预申请相关权限由多个位置分别判断角色。

普通预申请审核接口 `app/api/admin/pre-applications/[id]/review/route.ts` 只允许 `ADMIN` 处理。预申请申诉列表接口 `app/api/admin/pre-application-appeals/route.ts` 与申诉处理接口 `app/api/admin/pre-application-appeals/[id]/review/route.ts` 只允许 `SUPER_ADMIN` 访问。后台侧边栏与命令菜单也通过 `superAdminOnly` 或 `isSuperAdmin` 控制申诉入口。

申诉体系需要扩展为 `ADMIN` 与 `SUPER_ADMIN` 都能处理申请申诉，同时保留普通申请审核只由 `ADMIN` 处理的职责划分。由于申诉处理还涉及原拒绝审核人、复审请求发起人、归档状态、申诉状态等记录上下文，单纯按角色判断已经难以表达完整规则。

## 目标

本次设计建立三层权限结构：

| 层级 | 职责 |
|---|---|
| 角色层 | 保留现有 `USER`、`ADMIN`、`SUPER_ADMIN` |
| 能力层 | 描述账号具备的操作资格 |
| 资源规则层 | 结合具体申请、申诉、审核人和发起人判断是否允许操作 |

本次先覆盖预申请与申诉相关能力，其他管理模块后续逐步迁移。

## 能力定义

新增纯逻辑模块：

```text
lib/auth/capabilities.ts
```

建议定义以下能力：

```ts
type Capability =
  | "preApplication.review"
  | "preApplication.archive"
  | "preApplicationAppeal.view"
  | "preApplicationAppeal.review"
```

角色与能力映射如下：

| 能力 | `ADMIN` | `SUPER_ADMIN` |
|---|---:|---:|
| `preApplication.review` | 允许 | 禁止 |
| `preApplication.archive` | 允许 | 允许 |
| `preApplicationAppeal.view` | 允许 | 允许 |
| `preApplicationAppeal.review` | 允许 | 允许 |

基础函数建议：

```ts
hasCapability(role, capability)
getCapabilitiesForRole(role)
```

该文件只依赖 `Role` 类型，允许服务端和客户端共同使用。

## 预申请策略

新增策略模块：

```text
lib/auth/policies/pre-application.ts
```

建议包含以下函数：

```ts
canReviewPreApplication(actor)
canArchivePreApplication(actor, context)
```

普通预申请审核规则：

| 项目 | 规则 |
|---|---|
| 能力 | `preApplication.review` |
| 允许角色 | `ADMIN` |
| `SUPER_ADMIN` | 保持禁止 |
| 可审核状态 | 保持当前 `PENDING`、`DISPUTED`、`PENDING_REVIEW`、`ON_HOLD` |

归档规则：

| 项目 | 规则 |
|---|---|
| 能力 | `preApplication.archive` |
| 允许角色 | `ADMIN`、`SUPER_ADMIN` |
| 目标存在待处理申诉 | 拒绝归档 |
| 批量归档 | 任一目标存在待处理申诉时整批拒绝 |
| 已处理申诉 | 允许归档 |

批量归档接口 `app/api/admin/pre-applications/batch-archive/route.ts` 应在更新状态前查询 `PreApplicationAppealStatus.PENDING` 申诉，并返回冲突错误。

## 申诉查看策略

新增策略模块：

```text
lib/auth/policies/pre-application-appeal.ts
```

申诉列表与申诉页面使用能力：

```ts
preApplicationAppeal.view
```

规则如下：

| 项目 | 规则 |
|---|---|
| 允许角色 | `ADMIN`、`SUPER_ADMIN` |
| 列表记录 | 显示非归档申请关联的申诉 |
| 统计数据 | 使用同一非归档过滤条件 |
| 已归档申请关联申诉 | 从列表和统计排除 |

申诉列表接口应增加条件：

```ts
preApplication: {
  status: { not: PreApplicationStatus.ARCHIVED }
}
```

统计查询和列表查询使用同一个归档排除条件，避免数字与记录列表出现差异。

## 申诉处理策略

申诉处理使用能力：

```ts
preApplicationAppeal.review
```

资源规则如下：

| 校验项 | 规则 |
|---|---|
| 申诉状态 | 必须为 `PENDING` |
| 关联申请状态 | 必须为 `REJECTED` |
| 关联申请为 `ARCHIVED` | 拒绝处理 |
| 原拒绝审核人 | 不能处理该申诉 |
| 管理员复审请求发起人 | 不能处理该复审请求 |
| 并发更新 | 保留现有版本锁和状态锁 |

原拒绝审核人按“产生该申诉的那次拒绝审核”计算。优先使用已有版本历史与 `getAppealRejectionSnapshot` 类似的时间点判定方式。策略函数应接收或计算 `rejectionReviewedById`，避免使用“当前记录最新审核人”替代历史拒绝审核人。

建议策略函数：

```ts
canReviewPreApplicationAppeal(actor, appealContext)
getPreApplicationAppealReviewDeniedReason(actor, appealContext)
```

返回结构建议：

```ts
type PolicyResult =
  | { allowed: true }
  | {
      allowed: false
      reason:
        | "MISSING_CAPABILITY"
        | "ARCHIVED_PRE_APPLICATION"
        | "APPEAL_ALREADY_REVIEWED"
        | "TARGET_NOT_REJECTED"
        | "ORIGINAL_REVIEWER"
        | "REVIEW_REQUEST_INITIATOR"
    }
```

错误状态建议：

| 原因 | HTTP 状态 |
|---|---:|
| 未登录 | 401 |
| 缺少能力 | 403 |
| 命中回避规则 | 403 |
| 申诉已处理 | 409 |
| 目标申请状态变化 | 409 |
| 申请已归档 | 409 |

处理动作范围：

| 动作 | `ADMIN` | `SUPER_ADMIN` |
|---|---:|---:|
| 驳回申诉 | 允许 | 允许 |
| 推翻拒绝并通过申请 | 允许 | 允许 |

处理结果保持现有业务逻辑：

| 动作 | 结果 |
|---|---|
| 驳回申诉 | 申诉状态改为 `REJECTED`，申请保持 `REJECTED` |
| 通过申诉 | 申诉状态改为 `OVERRIDDEN`，申请改为 `APPROVED` |
| 驳回时提交封禁 | 保持现有封禁逻辑 |
| 通过时邀请码与发码状态 | 保持现有逻辑 |
| 站内信、邮件、审计日志 | 保持现有逻辑，审核人记录为当前处理人 |

## 前端显示规则

申诉页面 `app/[locale]/admin/pre-application-appeals/page.tsx` 改为允许具备 `preApplicationAppeal.view` 能力的账号进入。

后台侧边栏 `components/admin/sidebar.tsx` 与命令菜单 `components/admin/command-menu.tsx` 中的申诉入口改为基于能力显示：

```ts
requiredCapability: "preApplicationAppeal.view"
```

申诉表格 `components/admin/pre-application-appeals-table.tsx` 需要接收当前账号信息，或从接口返回每条记录相对当前账号的处理策略结果。

推荐由接口返回每条记录的处理状态：

```ts
reviewPolicy: {
  allowed: boolean
  reason: string | null
}
```

前端根据该字段决定按钮状态：

| 场景 | 显示 |
|---|---|
| 可处理 | 启用驳回与通过按钮 |
| 当前账号是原拒绝审核人 | 禁用处理按钮，显示回避原因 |
| 当前账号是复审请求发起人 | 禁用处理按钮，显示回避原因 |
| 申诉状态已处理 | 显示查看按钮 |

## 接口调整范围

| 文件 | 调整 |
|---|---|
| `app/api/admin/pre-application-appeals/route.ts` | 改为能力判断，列表和统计排除归档申请，返回处理策略结果 |
| `app/api/admin/pre-application-appeals/[id]/review/route.ts` | 改为能力判断，增加回避与归档校验 |
| `app/api/admin/pre-applications/batch-archive/route.ts` | 增加待处理申诉拦截 |
| `app/api/admin/pre-applications/[id]/review/route.ts` | 改为 `preApplication.review` 能力判断，保持仅 `ADMIN` 可审核 |
| `app/[locale]/admin/pre-application-appeals/page.tsx` | 改为能力判断 |
| `components/admin/sidebar.tsx` | 申诉入口改为能力控制 |
| `components/admin/command-menu.tsx` | 申诉入口改为能力控制 |
| `components/admin/pre-application-appeals-table.tsx` | 展示处理策略结果 |

## 数据库影响

本次设计无需新增表字段。

所需信息来自现有字段：

| 数据 | 来源 |
|---|---|
| 当前角色 | `User.role` |
| 申诉来源 | `PreApplicationAppeal.source` |
| 申诉发起人 | `PreApplicationAppeal.initiatedById` |
| 当前申请状态 | `PreApplication.status` |
| 申请版本历史 | `PreApplicationVersion` |
| 当前审核人 | `PreApplication.reviewedById` |

## 文案与错误键

需要补充或复用错误键与前端文案：

| 原因 | 文案含义 |
|---|---|
| `ORIGINAL_REVIEWER` | 当前账号是该申诉对应拒绝结果的审核人 |
| `REVIEW_REQUEST_INITIATOR` | 当前账号是该复审请求的发起人 |
| `ARCHIVED_PRE_APPLICATION` | 已归档申请无法处理申诉 |
| `APPEAL_ALREADY_REVIEWED` | 申诉已处理 |
| `TARGET_NOT_REJECTED` | 目标申请状态已变化 |
| `PENDING_APPEAL_EXISTS` | 存在待处理申诉，无法归档 |

中英文词典同步补充相同含义文案。

## 测试设计

建议增加以下测试：

| 测试 | 覆盖内容 |
|---|---|
| 能力映射测试 | `ADMIN` 和 `SUPER_ADMIN` 对预申请、申诉能力的差异 |
| 申诉策略测试 | 原审核人、复审发起人、归档申请、普通可处理账号 |
| 申诉列表测试 | `ADMIN` 可访问列表，归档申请被排除 |
| 申诉处理测试 | `ADMIN` 可处理，回避命中拒绝 |
| 归档测试 | 待处理申诉阻止批量归档 |

优先使用纯函数单元测试覆盖策略，再用源码断言或路由测试覆盖接口接入点。

## 验证命令

建议执行：

```bash
node --test tests/lib/pre-application-appeal-permissions.test.ts
node --test tests/lib/pre-application-archive-pending-appeals.test.ts
pnpm exec eslint lib/auth/capabilities.ts lib/auth/policies/pre-application.ts lib/auth/policies/pre-application-appeal.ts app/api/admin/pre-application-appeals/route.ts 'app/api/admin/pre-application-appeals/[id]/review/route.ts' 'app/api/admin/pre-applications/[id]/review/route.ts' app/api/admin/pre-applications/batch-archive/route.ts components/admin/pre-application-appeals-table.tsx components/admin/sidebar.tsx components/admin/command-menu.tsx --quiet
```

如果工作区已有类型检查问题，记录当前失败项并区分本次变更文件与既有问题。
