# 指纹审核增强设计

## 背景

当前系统在密码登录、验证码登录、OAuth 登录、通行密钥登录和预申请提交时记录浏览器指纹。现有浏览器端通过 FingerprintJS 产生 `visitorId`，后端在 `lib/fingerprint/server.ts` 中对该值计算 `fingerprintHash`，管理端在 `components/admin/risk-control-center.tsx` 中按哈希聚合查看关联用户和申请。

本次增强调整为浏览器提交指纹组件集合，后端生成绑定键并保存管理员可见的完整组件内容。管理端需要支持跨绑定键的相似提醒，处置方式为提醒审核，账号状态由管理员根据证据判断。

## 目标

一、浏览器端尽量采集常见环境、图形、设备、存储、字体、媒体、特性和异常状态。

二、后端完成组件清洗、规范化、绑定键生成、完整明细保存和相似度计算。

三、管理端默认完整展示指纹组件明细，支持查看相似对象、相同项、差异项和强证据。

四、同绑定键关联和跨绑定键相似对象共同进入管理端审核视图。

五、首轮只提供提醒审核，避免自动限制账号或申请行为。

## 非目标

一、本次设计不实现自动封禁、自动拒绝预申请或自动限制登录后功能。

二、本次设计不新增独立规则引擎，也不把邮箱、申请文本、邀请关系等全部纳入统一审查模型。

三、本次设计不改变现有登录、OAuth、通行密钥和预申请提交的成功条件，指纹采集异常仍只记录事件。

## 总体架构

采用“浏览器采集组件，后端生成绑定键，管理端查看明细和相似提醒”的结构。

```text
浏览器采集组件
        ↓
提交 fingerprintComponents
        ↓
后端清洗与规范化
        ↓
生成服务端绑定键 fingerprintHash
        ↓
保存事件明细和摘要
        ↓
计算同键关联和跨键相似提醒
        ↓
管理端展示分组、明细、相似对象、证据对比
```

当前链路保留 `FingerprintProfile`、`FingerprintEvent`、`User.latestFingerprintHash` 和 `PreApplication.fingerprintHash`。新增字段保存组件明细、摘要、相似分和相似证据。

## 数据模型

在现有 Prisma 模型上扩展字段。

```prisma
model FingerprintProfile {
  fingerprintHash  String  @unique
  fingerprintBasis Json?
  componentKeys    String[]
}

model FingerprintEvent {
  fingerprintComponents Json?
  fingerprintSummary    Json?
  similarityScore       Int?
  similaritySignals     Json?
}
```

字段含义如下。

| 字段 | 含义 |
| --- | --- |
| `fingerprintComponents` | 管理员可见的完整组件内容 |
| `fingerprintSummary` | 列表和详情顶部使用的摘要 |
| `fingerprintBasis` | 后端生成绑定键采用的稳定字段集合 |
| `componentKeys` | 参与绑定和对比的组件名称 |
| `similarityScore` | 当前事件与历史事件的最高相似分 |
| `similaritySignals` | 相同项、差异项、强证据项 |

`fingerprintHash` 继续作为服务端绑定键。旧数据保持可读，新数据会包含更多组件字段。

## 指纹组件采集

`lib/fingerprint/client.ts` 中的 `collectFingerprint` 改为返回 `fingerprintComponents`。保留 `fingerprintStatus` 和 `fingerprintFailureReason`，采集失败仍记录事件。

组件集合尽量覆盖以下类别。

| 类别 | 字段示例 |
| --- | --- |
| 浏览器环境 | User Agent、语言、时区、平台、Cookie 支持、Do Not Track |
| 屏幕信息 | 宽高、可用区域、色深、像素比、方向 |
| 设备能力 | CPU 核心数、设备内存、触控点、硬件并发 |
| 图形能力 | Canvas 摘要、WebGL Vendor、WebGL Renderer、WebGL 参数 |
| 媒体能力 | 音频上下文摘要、媒体设备数量 |
| 存储能力 | localStorage、sessionStorage、indexedDB、serviceWorker |
| 字体和插件 | 可检测字体、插件数量、MIME 类型数量 |
| 浏览器特性 | WebRTC、WebAssembly、WebGPU、权限状态摘要 |
| 异常状态 | 采集失败原因、字段缺失原因、浏览器限制说明 |

浏览器端只采集和提交组件内容，绑定键生成全部放在后端完成。

## 后端处理

新增 `lib/fingerprint/components.ts`，职责如下。

```text
清洗组件字段
限制字符串长度
过滤未知顶层字段
稳定排序
生成绑定键输入
生成摘要
```

新增 `lib/fingerprint/similarity.ts`，职责如下。

```text
比较两个组件集合
计算相同项数量
计算差异项数量
识别强证据字段
输出相似分和证据列表
```

`lib/fingerprint/server.ts` 调整记录流程。

```text
解析 fingerprintComponents
生成 fingerprintHash
写入 FingerprintProfile
写入 FingerprintEvent
更新 User.latestFingerprintHash
更新 PreApplication.fingerprintHash
计算 similarityScore
保存 similaritySignals
```

相似分取值范围为 0 到 100。高权重字段包括 WebGL Renderer、Canvas 摘要、时区、语言集合、字体集合、屏幕特征组合和设备能力组合。低权重字段包括窗口尺寸、临时权限状态和网络状态。

## 相似提醒

同绑定键对象继续作为强关联展示。跨绑定键对象按相似度进入审核视图。

相似提醒采用分层阈值。

| 等级 | 条件 |
| --- | --- |
| 高相似 | `similarityScore >= 85`，或 WebGL Renderer 与 Canvas 摘要同时一致且存在两个以上辅助相同项 |
| 中相似 | `similarityScore >= 70`，或存在三个以上中权重字段一致 |
| 低相似 | `similarityScore >= 55`，只作为详情参考 |

首轮处置方式为提醒审核。系统提高管理端显示优先级，并在详情页展示证据，不自动改变用户状态。

## 管理端界面

`components/admin/risk-control-center.tsx` 改为更适合审核的层级。

### 分组列表

列表展示以下列。

| 列 | 内容 |
| --- | --- |
| 绑定键 | 后端生成的 `fingerprintHash` 摘要 |
| 关联对象 | 用户数和申请数 |
| 相似提醒 | 最高相似分和相似对象数量 |
| 主要证据 | WebGL、Canvas、时区、字体、屏幕等标签 |
| 最近出现 | 最新事件时间 |
| 审核入口 | 打开详情抽屉 |

### 详情抽屉

详情抽屉分为四块。

```text
概览卡片
关联用户
相似对象
指纹组件明细
```

组件明细使用分组卡片展示，默认完整展示字段值。长文本字段使用等宽字体和换行展示。

### 证据对比

相似对象区域展示示例。

```text
相似分：86
相同项：WebGL Renderer、Canvas、时区、语言
差异项：屏幕宽度、设备内存
强证据：WebGL Renderer 和 Canvas 摘要同时一致
```

管理员可以同时看到相似原因和差异字段。

## API 和类型

需要更新以下位置。

| 位置 | 调整 |
| --- | --- |
| `lib/fingerprint/types.ts` | 新增 `fingerprintComponents` 类型 |
| `lib/fingerprint/payload.ts` | 解析组件集合 |
| `app/api/fingerprint/oauth-context/route.ts` | 支持 OAuth 前置保存组件 |
| `app/api/admin/risk-control/fingerprint-groups/route.ts` | 返回相似分和摘要 |
| `app/api/admin/risk-control/fingerprint-groups/[fingerprintHash]/route.ts` | 返回组件明细和相似对象 |
| `lib/openapi-spec.ts` | 更新公开接口和管理端接口文档 |

## 异常处理和限制

采集失败仍记录事件，状态为 `COLLECTION_FAILED`。

后端限制组件体积，超出限制时保存摘要和失败原因，避免单次请求影响登录或申请提交。

建议限制如下。

| 项目 | 限制 |
| --- | --- |
| 单个字符串 | 512 字符 |
| 单个数组 | 80 项 |
| JSON 总大小 | 32 KB |
| 事件查询 | 最近 50 条明细，最近 100 条用于相似计算 |

## 测试范围

新增和扩展测试如下。

| 测试文件 | 验证内容 |
| --- | --- |
| `tests/lib/fingerprint/components.test.ts` | 清洗、排序、绑定键稳定性 |
| `tests/lib/fingerprint/similarity.test.ts` | 相似分、相同项、差异项 |
| `tests/lib/fingerprint/payload.test.ts` | 请求体解析和异常字段 |
| `tests/lib/risk-control/fingerprint-server-bound-components.test.ts` | Prisma、接口、管理端、OpenAPI 字段存在 |
| `tests/lib/risk-control/fingerprint-risk.test.ts` | 相似提醒对等级和排序的影响 |

## 实施顺序

一、测试先行，新增组件清洗、相似度、请求体解析和字段存在性测试。

二、扩展 Prisma schema 和 TypeScript 类型。

三、实现组件清洗、绑定键生成和相似度计算模块。

四、更新指纹记录链路和 OAuth 上下文链路。

五、更新管理端列表、详情抽屉和多语言文案。

六、更新 OpenAPI 文档。

七、运行测试、类型检查和必要的格式检查。
