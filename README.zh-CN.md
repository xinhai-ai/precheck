# Next 启动模板

[English](README.md) | 简体中文

一个生产就绪的 Next.js 启动模板，包含 React、TypeScript、Tailwind CSS、shadcn/ui、Prisma 和 Docker 支持。

## 功能特性

- **Next.js 16** - 最新 App Router 与 React Server Components
- **TypeScript** - 严格模式下的完整类型安全
- **Tailwind CSS v4** - 实用优先的样式方案
- **shadcn/ui** - 美观且可访问的组件库
- **Framer Motion** - 流畅的动画效果
- **Lucide Icons** - 高质量图标库
- **Prisma** - 类型安全的数据库 ORM
- **Docker** - 容器化部署支持
- **富文本编辑器** - 基于 Tiptap 的编辑与预览模式
- **站内信** - 管理员发送、用户收件箱与已读状态
- **预申请申诉** - 被驳回用户可申请超级管理员复审，带冷静期与惩罚规则
- **前端指纹追踪** - 登录与预申请提交采集浏览器指纹，管理端支持关联检索
- **主题与语言** - 浅色/深色主题切换 + 语言切换
- **多平台部署** - 可部署到 Vercel、Cloudflare、Netlify、Railway、Fly.io 等

## 快速开始

```bash
# 克隆仓库
npx create-next-app -e https://github.com/h7ml/next-starter next-starter

# 进入项目目录
cd next-starter

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# Docker/自托管场景下，可在运行时设置 SEO 绝对链接使用的域名
# APP_URL="https://example.com"

# 启动开发服务器
npm run dev
```

## 数据库设置

```bash
# 生成 Prisma Client
npx prisma generate

# 生成 Prisma 字段类型定义（d.ts）
npm run prisma:types

# 推送 schema 到数据库
npx prisma db push

# 打开 Prisma Studio
npx prisma studio
```

生成的类型定义会输出到 `types/prisma.d.ts`。

## 站内信功能

- 管理员可创建并管理站内信，支持全选、按角色、按状态、指定用户发送。
- 用户可在 `/{locale}/dashboard/messages` 查看与阅读，支持已读/未读状态。
- 控制台铃铛展示最新一条站内信并跳转到收件箱。

## 预申请申诉

- 已登录且被驳回的用户可在 `/{locale}/dashboard/pre-application` 提交预申请申诉。
- 申诉受超级管理员开关控制，并带有“单条申请仅允许一个待处理申诉”与 3 天冷静期限制。
- 超级管理员可在 `/{locale}/admin/pre-application-appeals` 审核申诉，并决定驳回申诉或将原预申请恢复为 `PENDING`。
- 驳回申诉会通过 `User.preApplicationSubmitBannedUntil` 对用户施加 3 天提交封禁。

## 前端指纹功能

- 密码登录、验证码登录、OAuth 登录均记录浏览器指纹。
- 登录后控制台预申请提交会记录浏览器指纹。
- 管理端预申请详情抽屉可查看指纹信息及同指纹关联用户/申请。
- 管理端预申请与用户页支持按指纹哈希检索，导出 CSV 带出指纹字段。
- 浏览器端提交指纹组件集合，后端生成绑定键并保存管理员可见的组件明细。
- 环境开关：`FEATURE_FINGERPRINT`、`NEXT_PUBLIC_FEATURE_FINGERPRINT`、`FINGERPRINT_PEPPER`。

## 后台功能概览

- **用户端控制台**：概览、文章管理、数据分析、设置、站内信收件箱、被驳回申请的申诉入口。
- **管理端**：用户管理、文章审核、数据分析、系统设置、站内信管理（创建/编辑/撤回）、仅超级管理员可见的预申请申诉审核队列。
- **权限**：基于 Session 的登录态与角色校验，管理端仅管理员可访问。
- **主题**：顶部栏与控制台支持主题切换。
- **语言**：顶部栏与控制台支持语言切换。

## 代码质量

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check

# 代码检查（ESLint + TSLint）
npm run lint

# 修复 lint
npm run lint:fix

# TypeScript 类型检查
npm run typecheck

# 一键修复后完整检查
npm run fix:check
```

## Docker 部署

```bash
# 使用 Docker Compose 构建并运行
docker compose up -d

# 或手动构建
docker build -t next-starter .
docker run -p 3000:3000 -e APP_URL="https://example.com" next-starter
```

请在容器运行时环境中设置 `APP_URL`，这样 SEO 元数据、站点地图、Feed、`robots.txt` 等绝对链接会使用真实域名，而不需要重新构建镜像。

## 项目结构

```
├── app/                  # Next.js App Router 页面
│   ├── api/             # API 路由
│   ├── docs/            # 文档页面
│   └── page.tsx         # 首页
├── components/          # React 组件
│   ├── layout/          # 布局组件
│   ├── sections/        # 页面区块
│   ├── providers/       # 上下文提供者
│   └── ui/              # shadcn/ui 组件
├── lib/                 # 工具库
│   ├── db.ts           # Prisma 客户端
│   ├── env.ts          # 环境变量校验
│   └── utils.ts        # 通用工具函数
├── prisma/              # 数据库
│   └── schema.prisma   # Prisma 模型
├── Dockerfile          # Docker 配置
├── docker-compose.yml  # Docker Compose 配置
├── fly.toml            # Fly.io 配置
├── netlify.toml        # Netlify 配置
├── railway.yaml        # Railway 配置
└── vercel.json         # Vercel 配置
```

## 部署

| 平台             | 指南                                    |
| ---------------- | --------------------------------------- |
| Vercel           | [Deploy](https://vercel.com/new)        |
| Cloudflare Pages | [Deploy](https://pages.cloudflare.com)  |
| Netlify          | [Deploy](https://app.netlify.com/start) |
| Railway          | [Deploy](https://railway.app/new)       |
| Fly.io           | `fly launch && fly deploy`              |
| Deno Deploy      | [Deploy](https://deno.com/deploy)       |

## 许可证

MIT License - 你可以自由地将该模板用于任何项目。
