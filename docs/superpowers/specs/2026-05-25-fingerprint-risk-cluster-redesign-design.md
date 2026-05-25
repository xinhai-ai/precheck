# 全量指纹风险簇重设计

## 1. 背景

当前指纹采集链路已经从单一 `visitorId` 扩展到全量 `fingerprintComponents`。数据库中的 `FingerprintEvent` 已经保存 `fingerprintComponents`、`fingerprintSummary`、`similarityScore` 和 `similaritySignals`，后端也已经具备组件清洗、摘要生成和相似度比较能力。

风控中心仍然沿用旧结构：列表接口按 `fingerprintHash` 聚合，详情接口以 `fingerprintHash` 作为参数，预申请详情也通过 `fingerprintHash` 查找关联用户和申请。这会把“全量组件相似”降级为“同一个哈希”，无法表达部分相似、强证据相同、弱证据差异、浏览器差异等情况。

本设计将风控主对象从 `fingerprintHash` 分组改为“全量指纹风险簇”。`fingerprintHash` 继续保留为兼容字段和排查字段，风险判断、后台列表、详情、关联对象和审核入口都围绕风险簇展开。

## 2. 目标

一、把后台风控的主索引从 `fingerprintHash` 切换为 `FingerprintRiskCluster.id`。

二、使用全量指纹组件的相似度、强证据字段、时间集中度、网络重合和跨事件连续性计算风险等级。

三、保留现有指纹采集、事件保存、摘要生成和相似度比较能力，并在此基础上新增风险簇归类。

四、让管理端展示“风险线索”，而非展示“指纹哈希分组”。

五、兼容旧数据。缺少全量组件的历史记录以低可信历史线索处理。

## 3. 范围外

一、自动封禁账号、自动拒绝预申请、自动限制登录成功条件。

二、把邮箱、申请文本、邀请关系、IP 地理位置纳入统一规则引擎。

三、删除 `fingerprintHash`、`User.latestFingerprintHash`、`PreApplication.fingerprintHash` 等兼容字段。

四、一次性移除旧 `fingerprint-groups` 接口。旧接口在迁移期保留，管理端优先使用新接口。

## 4. 当前依赖点

| 位置 | 当前职责 | 改造影响 |
| --- | --- | --- |
| `prisma/schema.prisma` | `FingerprintEvent` 保存哈希、全量组件、摘要和相似度 | 新增风险簇模型，保留事件模型 |
| `lib/fingerprint/components.ts` | 清洗组件、生成绑定键、生成摘要 | 保留，继续为风控提供组件和摘要 |
| `lib/fingerprint/similarity.ts` | 比较组件并输出分数、相同项、差异项、强证据项 | 扩展为风险簇归类依据 |
| `lib/fingerprint/server.ts` | 记录指纹事件，保存摘要和相似度 | 事件保存后触发风险簇维护 |
| `lib/risk-control/fingerprint-risk.ts` | 旧的风险分组类型与等级计算 | 改为风险簇类型、评分和证据函数 |
| `app/api/admin/risk-control/fingerprint-groups/route.ts` | 按哈希输出列表 | 新增风险簇列表接口后降级为兼容接口 |
| `app/api/admin/risk-control/fingerprint-groups/[fingerprintHash]/route.ts` | 按哈希输出详情 | 新增风险簇详情接口后降级为兼容接口 |
| `components/admin/risk-control-center.tsx` | 展示哈希分组、相似事件、组件明细 | 改为风险簇列表和风险簇详情 |
| `app/api/admin/pre-applications/[id]/fingerprint/route.ts` | 按申请的 `fingerprintHash` 查关联对象 | 改为按申请对应事件所属风险簇查关联对象 |

## 5. 数据模型

新增 `FingerprintRiskCluster` 和 `FingerprintRiskClusterMember`。

```prisma
model FingerprintRiskCluster {
  id               String   @id @default(cuid())
  anchorEventId    String?
  riskLevel        String
  riskScore        Int
  userCount        Int      @default(0)
  applicationCount Int      @default(0)
  eventCount       Int      @default(0)
  maxSimilarity    Int?
  evidenceFlags    String[] @default([])
  summary          Json?
  firstSeenAt      DateTime
  lastSeenAt       DateTime
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  members FingerprintRiskClusterMember[]

  @@index([riskLevel, lastSeenAt])
  @@index([lastSeenAt])
}

model FingerprintRiskClusterMember {
  id              String   @id @default(cuid())
  clusterId       String
  eventId         String   @unique
  similarityScore Int
  matchedKeys     String[] @default([])
  differentKeys   String[] @default([])
  strongKeys      String[] @default([])
  createdAt       DateTime @default(now())

  cluster FingerprintRiskCluster @relation(fields: [clusterId], references: [id], onDelete: Cascade)

  @@index([clusterId, similarityScore])
}
```

字段说明如下。

| 字段 | 含义 |
| --- | --- |
| `FingerprintRiskCluster.id` | 管理端列表和详情使用的主键 |
| `anchorEventId` | 风险簇代表事件，通常为首次创建或证据最完整的事件 |
| `riskScore` | 0 到 100 的综合分 |
| `riskLevel` | `LOW`、`MEDIUM`、`HIGH` |
| `maxSimilarity` | 成员间最高相似分 |
| `evidenceFlags` | 风险证据标签 |
| `summary` | 管理端列表摘要 |
| `eventId` | 指纹事件 ID，确保一个事件只归属一个风险簇 |
| `matchedKeys` | 与锚点事件一致的组件字段 |
| `differentKeys` | 与锚点事件存在差异的组件字段 |
| `strongKeys` | 强证据字段，例如 WebGL、Canvas、字体集合 |

## 6. 风控引擎

新增 `lib/risk-control/fingerprint-cluster.ts`。

该模块负责把指纹事件归入风险簇，并更新风险簇统计值。

```text
FingerprintEvent
        ↓
读取 fingerprintComponents
        ↓
查找近期候选风险簇
        ↓
比较锚点组件与当前组件
        ↓
满足阈值则加入风险簇
        ↓
否则创建新风险簇
        ↓
重新计算 riskScore、riskLevel、evidenceFlags
```

候选风险簇查询建议优先使用近期事件和高相似事件，避免全表比较。首版候选范围可以采用最近 200 个含组件的事件，后续可改为索引化候选。

### 6.1 归簇阈值

| 条件 | 处理 |
| --- | --- |
| `score >= 85` | 加入已有风险簇 |
| `score >= 75` 且 `strongKeys.length >= 2` | 加入已有风险簇 |
| `score >= 65` 且存在 `networkKey` 重合和近期集中出现 | 加入已有风险簇 |
| 其他情况 | 创建新风险簇 |

`fingerprintHash` 完全一致时，仍然可以作为强证据之一，但不能作为唯一条件。

### 6.2 评分规则

`riskScore` 由多个因素叠加，并截断在 0 到 100。

| 因素 | 分值 |
| --- | --- |
| 成员最高相似分大于等于 85 | 35 |
| 强证据字段大于等于 2 个 | 25 |
| 关联用户数大于等于 2 | 20 |
| 关联申请数大于等于 2 | 15 |
| 24 小时内出现多个用户或申请 | 15 |
| 网络标识重合 | 10 |
| 同一用户跨登录和申请事件连续出现 | 10 |
| Safari 低可信环境缺少额外证据 | 扣 20 |

等级换算如下。

| 等级 | 条件 |
| --- | --- |
| `HIGH` | `riskScore >= 70` |
| `MEDIUM` | `riskScore >= 40` |
| `LOW` | `riskScore < 40` |

### 6.3 证据标签

保留现有标签，并新增全量指纹专用标签。

| 标签 | 含义 |
| --- | --- |
| `recentConcentration` | 近期集中出现 |
| `networkOverlap` | 网络标识重合 |
| `crossEventContinuity` | 登录与申请事件连续出现 |
| `componentSimilarity` | 全量组件相似 |
| `strongComponentMatch` | 强证据字段匹配 |
| `hashExactMatch` | 兼容哈希完全一致 |
| `safariLowConfidence` | Safari 低可信提醒 |

## 7. 写入流程

`recordFingerprintEvent` 继续负责记录指纹事件。事件写入后调用风险簇维护函数。

```text
normalizeFingerprintPayload
        ↓
create FingerprintEvent
        ↓
upsert FingerprintProfile
        ↓
update User.latestFingerprintHash
        ↓
update PreApplication.fingerprintHash
        ↓
assignFingerprintRiskCluster
```

为了便于测试和回填，`assignFingerprintRiskCluster` 接收 `eventId`，内部读取事件、组件、用户、申请和网络元数据。

## 8. 管理端接口

新增风险簇接口。

```text
GET /api/admin/risk-control/fingerprint-clusters
GET /api/admin/risk-control/fingerprint-clusters/{clusterId}
```

列表查询参数如下。

| 参数 | 含义 |
| --- | --- |
| `page` | 页码 |
| `limit` | 每页数量 |
| `search` | 邮箱、事件 ID、风险簇 ID、兼容哈希 |
| `riskLevel` | 风险等级 |
| `sortBy` | `riskScore`、`lastSeenAt`、`userCount`、`applicationCount` |
| `sortOrder` | `asc` 或 `desc` |

列表返回类型如下。

```ts
type FingerprintRiskClusterItem = {
  id: string
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  riskScore: number
  userCount: number
  applicationCount: number
  eventCount: number
  maxSimilarity: number | null
  evidenceFlags: string[]
  summary: FingerprintSummary | null
  firstSeenAt: string
  lastSeenAt: string
}
```

详情返回类型如下。

```ts
type FingerprintRiskClusterDetail = {
  summary: FingerprintRiskClusterItem
  relatedUsers: FingerprintRiskDetailUser[]
  relatedApplications: FingerprintRiskDetailApplication[]
  members: FingerprintRiskClusterMemberDetail[]
  componentEvidence: {
    anchor: FingerprintComponents | null
    samples: FingerprintComponents[]
  }
  ignoredImpact: number
}
```

旧 `fingerprint-groups` 接口在迁移期保留。管理端页面切换到新接口后，旧接口只承担兼容和排查用途。

## 9. 管理端界面

页面标题从“风险控制中心”保持不变，主内容从“风险分组”改为“风险线索”。

### 9.1 列表

| 列 | 内容 |
| --- | --- |
| 风险 | 风险等级和 `riskScore` |
| 关联对象 | 用户数、申请数、事件数 |
| 关键证据 | `strongComponentMatch`、`networkOverlap` 等标签 |
| 指纹摘要 | 浏览器、平台、屏幕、WebGL 摘要 |
| 最近出现 | `lastSeenAt` |
| 查看 | 打开风险簇详情 |

列表不再展示完整哈希。哈希放入详情中的兼容信息区域。

### 9.2 详情

详情抽屉分为四个区块。

| 区块 | 内容 |
| --- | --- |
| 摘要 | 风险等级、分数、证据标签、首次出现、最近出现 |
| 关联对象 | 用户和申请，保留忽略、封禁、打开用户管理入口 |
| 指纹证据 | 成员事件、相似分、相同项、差异项、强证据 |
| 原始组件 | 锚点组件和样本组件，默认折叠 |

详情中仍显示 `fingerprintHash`，但名称改为“兼容哈希”或“旧绑定键”。

## 10. 预申请详情

`app/api/admin/pre-applications/[id]/fingerprint/route.ts` 当前通过申请的 `fingerprintHash` 查询关联用户和申请。新逻辑改为：

```text
查找当前申请最新 FingerprintEvent
        ↓
查找 FingerprintRiskClusterMember
        ↓
读取 FingerprintRiskCluster
        ↓
通过同簇成员事件聚合关联用户和申请
```

返回内容保留现有字段，同时新增风险簇信息。

```ts
type AdminPreApplicationFingerprintDetail = {
  id: string
  fingerprintHash: string | null
  fingerprintStatus: "OK" | "COLLECTION_FAILED"
  fingerprintCollectedAt: string | null
  riskCluster: {
    id: string
    riskLevel: "LOW" | "MEDIUM" | "HIGH"
    riskScore: number
    evidenceFlags: string[]
  } | null
  relatedUsersCount: number
  relatedApplicationsCount: number
  relatedUsers: RelatedUser[]
  relatedApplications: RelatedApplication[]
}
```

## 11. 回填

新增脚本读取历史 `FingerprintEvent`。

```text
读取含 fingerprintComponents 的事件
        ↓
按时间顺序调用 assignFingerprintRiskCluster
        ↓
缺少组件但有 fingerprintHash 的事件生成低可信历史簇
        ↓
输出创建数量、成员数量、低可信数量
```

建议脚本位置为 `scripts/backfill-fingerprint-risk-clusters.ts`。

## 12. 测试

| 测试文件 | 验证内容 |
| --- | --- |
| `tests/lib/risk-control/fingerprint-cluster.test.ts` | 相似度归簇、创建新簇、更新分数 |
| `tests/lib/risk-control/fingerprint-risk.test.ts` | `riskScore`、`riskLevel`、证据标签 |
| `tests/lib/risk-control/fingerprint-cluster-routes.test.ts` | 新列表和详情接口源码字段 |
| `tests/lib/risk-control/fingerprint-server-bound-components.test.ts` | 从旧 hash 分组断言改为风险簇断言 |
| `tests/lib/risk-control/fingerprint-safari-mitigation.test.ts` | Safari 低可信扣分与额外证据晋级 |
| `tests/lib/fingerprint/similarity.test.ts` | 全量组件相似度和强证据字段 |

现有 source tests 对源码字符串敏感，重命名接口和类型时需要同步更新断言。

## 13. 实施顺序

一、新增 Prisma 模型和类型输出。

二、实现 `lib/risk-control/fingerprint-cluster.ts`，并补充单元测试。

三、在 `recordFingerprintEvent` 写入事件后维护风险簇。

四、新增 `fingerprint-clusters` 列表和详情接口。

五、管理端切换到风险簇接口，简化列表和详情展示。

六、预申请详情从哈希关联改为风险簇关联。

七、补充历史回填脚本。

八、更新 OpenAPI、字典和测试断言。

## 14. 验收标准

一、后台风控列表展示风险簇，而非哈希分组。

二、两个 `fingerprintHash` 不同但全量组件高度相似的事件会进入同一个风险簇。

三、同一风险簇详情可以展示相关用户、相关申请、成员事件和强证据字段。

四、预申请详情可以通过风险簇看到相关用户和申请。

五、旧 `fingerprintHash` 仍可在详情中查看，兼容导出和历史排查。

六、Safari 低可信场景需要额外证据才能提升风险等级。

七、历史事件回填后可形成风险簇，并且缺少全量组件的旧记录不会阻断回填。
