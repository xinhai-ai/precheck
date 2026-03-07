# 预申请后台复审与申诉自动拒绝设计

## 背景

当前仓库已经具备“用户对自己被驳回的预申请提交申诉、超级管理员审核申诉”的完整链路，但仍有三个明显缺口：

- 管理员或超级管理员无法主动为任意一条已驳回申请提交复审。
- 申诉/复审驳回后的提交封禁策略仍然依赖固定天数，缺少超级管理员在审核时的动态控制。
- 用户端没有足够明确地提示“申诉不是重新提交申请”，也缺少针对低质量申诉的自动拒绝能力。

本次设计希望在尽量复用现有 `PreApplicationAppeal` 队列、审核页面与通知审计基础设施的前提下，补齐这三块能力。

## 目标

- 允许 `ADMIN` 与 `SUPER_ADMIN` 对任意 `REJECTED` 的预申请主动提交“复审请求”。
- 继续复用同一套 `PreApplicationAppeal` 队列，但显式区分“用户申诉”和“管理员发起复审”的来源。
- 维持“同一条申请同一时刻最多一条待处理记录”的并发约束。
- 超级管理员审核通过时，直接按正常审核流将主申请更新为 `APPROVED`，并完整写入 `guidance / reviewedAt / reviewedById / version` 等字段。
- 超级管理员审核驳回时，可配置“是否封禁提交权限”以及“封禁天数”，不再强制固定时长。
- 为用户申诉增加醒目风险提示，并支持基于“驳回意见 guidance 命中正则”自动拒绝申诉。

## 已确认规则

- 管理员/超级管理员都可以为任意已驳回申请发起复审。
- 复审创建后进入现有申诉队列，由超级管理员审核。
- 复审审核权限仅限超级管理员。
- 同一条申请在任意时刻只允许存在一条 `PENDING` 记录；无论来源是用户申诉还是管理员复审，都共享这一约束。
- 管理员发起复审时，不受“用户申诉功能开关”和“3 天冷静期”限制，只要求目标申请当前为 `REJECTED` 且不存在待处理记录。
- 超级管理员审核通过时，主申请直接进入 `APPROVED`，并写入正常审核所需的指导意见和版本历史。
- 管理员发起复审时必须填写原因，并在创建成功后立即通知申请人。
- 用户端申诉弹窗需要明确警告：申诉不是重新提交预申请；申诉被驳回后可能被限制再次提交预申请。
- 超级管理员驳回复审/申诉时，需要显式决定是否封禁及封禁天数，而不是固定 7 天。
- 增加“自动拒绝申诉”能力，只匹配当前驳回意见 `guidance`，且仅对用户自己发起的申诉生效。
- 自动拒绝规则由超级管理员在设置页维护，支持总开关、多条正则、以及“自动拒绝后是否封禁/封禁天数”的默认策略。
- 自动拒绝命中后仍需创建一条申诉记录，但直接落成 `REJECTED`，并标记为系统自动拒绝。

## 方案选择

采用“继续复用 `PreApplicationAppeal`，但补充来源、发起人、审核结果元数据”的方案，而不是新增独立复审表。

理由：

- 现有用户申诉页、管理员申诉列表、超级管理员审核接口、OpenAPI、通知与审计链路已经围绕 `PreApplicationAppeal` 成型，复用成本最低。
- 用户申诉与管理员复审本质上都是“对当前驳回决定提出再次审核请求”，共享同一条待处理队列更符合你确认的产品方向。
- 通过新增来源字段，可以在不拆分表结构的情况下保持来源可见、可筛选、可统计。
- 自动拒绝本质上也是这条队列中的一种“系统快速驳回”结果，继续落在同一张表里更利于时间线和审计一致性。

## 数据模型设计

### `PreApplicationAppeal`

在现有模型基础上新增以下字段：

- `source`: `USER_APPEAL | ADMIN_REVIEW_REQUEST`
- `initiatedById`: 实际发起人 ID
- `submitBanApplied`: 本次驳回后是否施加提交封禁
- `submitBanDays`: 本次驳回决定的封禁天数
- `submitBanUntil`: 本次驳回最终生效的封禁截止时间
- `autoRejected`: 是否为系统自动拒绝
- `autoRejectedPattern`: 命中的正则表达式（可空）

保留现有字段语义：

- `userId` 仍表示“该申请所属用户”，不等于发起人。
- `reviewedById` 仍表示“最终人工审核人”；系统自动拒绝时保持 `null`。
- `reviewComment` 继续存最终审核说明；系统自动拒绝时写标准化提示文案。

关系调整：

- `User.preApplicationAppeals` 继续表示申请所属用户关联记录。
- 新增 `User.preApplicationAppealsInitiated` 表示发起人关联。
- 现有 `User.preApplicationAppealsReviewed` 保持不变。

### `PreApplicationAppealSource`

新增来源枚举：

- `USER_APPEAL`
- `ADMIN_REVIEW_REQUEST`

### `SiteSettings`

新增以下系统配置字段：

- `preApplicationAppealAutoRejectEnabled Boolean @default(false)`
- `preApplicationAppealAutoRejectPatterns Json @default("[]")`
- `preApplicationAppealAutoRejectApplySubmitBan Boolean @default(false)`
- `preApplicationAppealAutoRejectSubmitBanDays Int @default(7)`

说明：

- 这些设置只作用于用户自己发起的申诉。
- 默认封禁天数取 `7`，与当前仓库中既有的固定惩罚时长保持一致。

### 迁移与回填

历史数据需要一次性回填：

- `source = USER_APPEAL`
- `initiatedById = userId`
- `submitBanApplied = false`
- `autoRejected = false`

现有数据库中的“同一申请只允许一条 `PENDING` 申诉”的部分唯一索引应保留，无需按来源拆分，因为你的规则就是两类来源共享同一待处理槽位。

## 主流程设计

### 1. 用户自己发起申诉

入口仍为 `POST /api/pre-application/appeal`。

处理顺序：

1. 校验登录态、主申请归属、主申请状态为 `REJECTED`。
2. 校验站点申诉开关开启。
3. 校验同一申请不存在 `PENDING` 记录。
4. 校验 3 天冷静期。
5. 读取当前这次驳回的 `guidance`。
6. 若自动拒绝功能开启，则用正则列表逐条匹配 `guidance``。`
7. 未命中则创建 `source=USER_APPEAL`、`status=PENDING` 的记录。
8. 命中则直接创建 `source=USER_APPEAL`、`status=REJECTED`、`autoRejected=true` 的记录，并按系统配置决定是否更新 `User.preApplicationSubmitBannedUntil`。

### 2. 管理员/超级管理员发起复审

新增后台路由：`POST /api/admin/pre-applications/{id}/review-request`。

校验规则：

- 当前用户必须是 `ADMIN` 或 `SUPER_ADMIN`。
- 目标申请必须存在且当前状态为 `REJECTED`。
- 该申请当前不能存在 `PENDING` 记录。
- `reason` 必填。

写入内容：

- `source = ADMIN_REVIEW_REQUEST`
- `initiatedById = 当前管理员`
- `userId = 申请所属用户`
- `status = PENDING`
- `reason = 管理员填写原因`

创建成功后立即给申请人发站内信，说明管理员已为该条被驳回申请发起复审。

### 3. 超级管理员审核通过

继续复用 `POST /api/admin/pre-application-appeals/{id}/review`，动作保持 `APPROVE`。

通过分支：

- 申诉/复审记录更新为 `OVERRIDDEN`。
- 主申请从 `REJECTED` 直接更新为 `APPROVED`。
- `PreApplication.guidance = reviewComment`。
- 写入 `reviewedAt`、`reviewedById`、`version + 1`。
- 新建 `PreApplicationVersion(status=APPROVED)`，保留当前主申请正文、来源、邮箱、群组与指导意见。
- 发站内信通知用户“申诉/复审已通过，申请已直接通过”。

这里不区分来源，统一复用同一套“通过后主申请直接通过”的逻辑。

### 4. 超级管理员审核驳回

审核弹窗新增两个输入：

- `applySubmitBan: boolean`
- `submitBanDays?: number`

驳回分支：

- 记录更新为 `REJECTED`。
- `reviewComment` 必填。
- 若 `applySubmitBan = true`，则按 `submitBanDays` 与现有提交封禁截止时间比较，写入更晚的截止时间。
- 若 `applySubmitBan = false`，则不更新用户提交权限。
- 将本次决策写入 `submitBanApplied / submitBanDays / submitBanUntil`，确保历史可追溯。
- 通知模板按条件显示封禁结果；未封禁时不出现截止时间文案。

## 页面与交互设计

### 管理端：已驳回申请发起复审

入口建议同时放在两处：

- `components/admin/pre-applications-table.tsx` 的列表行操作
- 预申请详情抽屉/详情区中

展示条件：

- 仅 `REJECTED` 状态显示
- 当前用户角色为 `ADMIN` 或 `SUPER_ADMIN`
- 当前申请不存在 `PENDING` 的申诉/复审记录

弹窗字段：

- `reason`（必填）

不在创建时填写 `guidance`，因为最终审核意见必须由超级管理员在通过时给出。

### 超级管理员申诉/复审列表

继续使用 `/{locale}/admin/pre-application-appeals`。

列表增加：

- 来源徽标：`用户申诉` / `管理员复审`
- 发起人列：显示 `initiatedBy`
- 可选来源筛选：`ALL | USER_APPEAL | ADMIN_REVIEW_REQUEST`
- 自动拒绝标识：对 `autoRejected = true` 的记录显示“系统自动拒绝”徽标

待处理记录的审核弹窗中：

- `APPROVE` 模式下继续只要求填写最终指导意见。
- `REJECT` 模式下显示“是否封禁 + 封禁天数”控件，默认 `开启 + 7 天`。

### 用户端申诉弹窗

`components/dashboard/pre-application-appeal-dialog.tsx` 需要新增醒目警告块，并在提交前要求用户确认：

- 申诉不是重新提交预申请，而是对当前预申请驳回结果提出异议。
- 申诉被驳回后可能会被限制再次提交预申请。
- 是否封禁以及封禁天数由超级管理员在审核时决定。
- 系统可能根据当前驳回意见自动拒绝部分申诉。

推荐增加一个必勾选确认项，减少用户误解与误操作。

### 用户端时间线

用户侧 `GET /api/pre-application/appeal` 继续返回该申请下的全部记录，但需要补充：

- `source`
- `initiatedBy`
- `submitBanApplied`
- `submitBanDays`
- `submitBanUntil`
- `autoRejected`

这样用户能在时间线里看到“这是自己提交的申诉，还是管理员代为发起的复审”，以及某次驳回是否触发了封禁。

## 自动拒绝设计

### 配置方式

放在超级管理员设置页已有的“系统配置 / 预申请相关设置”区域中，包含：

- 自动拒绝申诉开关
- 多条正则规则列表
- 自动拒绝后是否封禁提交权限
- 自动拒绝封禁天数

规则以字符串数组存储；保存设置时即完成 `RegExp` 编译校验，非法规则不允许保存。

### 匹配范围

只匹配“当前这次驳回意见 `guidance`”，不匹配：

- 用户填写的申诉理由
- 原预申请正文 `essay`
- 管理员发起复审的原因

### 命中后的行为

命中任意一条规则即：

- 创建一条 `REJECTED` 记录
- `source = USER_APPEAL`
- `initiatedById = userId`
- `autoRejected = true`
- `autoRejectedPattern = 命中的规则`
- `reviewedById = null`
- `reviewedAt = now`
- `reviewComment = 系统自动拒绝说明`

若系统配置要求自动封禁，则同步更新 `User.preApplicationSubmitBannedUntil`，并将结果落在 `submitBanApplied / submitBanDays / submitBanUntil` 字段中。

## 通知与审计

### 通知

至少需要新增或调整三类通知：

- 管理员发起复审成功：立即通知申请人“管理员已为你的申请发起复审”。
- 自动拒绝申诉：立即通知申请人“申诉已被系统自动拒绝”，并按条件显示封禁信息。
- 超级管理员审核驳回：若封禁则带上封禁截止时间；若不封禁则不出现封禁文案。

### 审计

建议保留现有审核动作枚举，但在 metadata 中补充：

- `source`
- `initiatedById`
- `applySubmitBan`
- `submitBanDays`
- `submitBanUntil`
- `autoRejected`
- `autoRejectedPattern`

另外新增一个“管理员发起复审”动作，用于和用户自己提交申诉区分。

## 测试策略

优先走 TDD，并以现有 `node:test` 为主，不额外引入前端测试框架。

建议覆盖以下内容：

1. `appeal-utils`：
   - 动态封禁天数计算
   - 正则规则规范化与命中逻辑
   - 自动拒绝只匹配 `guidance`
2. OpenAPI / 字典：
   - 新增后台复审创建接口
   - `PreApplicationAppeal` 返回结构新增来源与封禁字段
   - 中英文文案包含来源、自动拒绝、用户警告、可配置封禁提示
3. 审核接口：
   - `APPROVE` 会直接把主申请写成 `APPROVED`
   - `REJECT + 不封禁` 不更新 `preApplicationSubmitBannedUntil`
   - `REJECT + 封禁 N 天` 会更新为正确时间
4. 用户申诉接口：
   - 命中规则时直接创建 `REJECTED` 记录，不进入待处理队列
   - 未命中规则时正常创建 `PENDING` 记录

## 风险与边界

- 由于继续复用 `OVERRIDDEN` 表示“申诉/复审被接受”，需要统一前端文案，避免误显示成“恢复待审”。
- 自动拒绝匹配目标是 `guidance`，如果历史驳回记录缺少指导意见，则默认不触发自动拒绝。
- 自动拒绝属于同步判定；本次设计不引入异步任务或规则命中队列。
- 现有全量类型检查和构建若存在环境依赖，落地时优先保证定向测试、Prisma 生成与改动文件的类型完整性。
