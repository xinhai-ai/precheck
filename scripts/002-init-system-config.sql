-- 初始化系统配置（站点名称、邮箱白名单等）
-- 使用方式: psql $DATABASE_URL -f scripts/002-init-system-config.sql
-- 如果 SiteSettings 表中已有记录则跳过

INSERT INTO "SiteSettings" (
  "id",
  "siteName",
  "siteDescription",
  "contactEmail",
  "preApplicationEssayHint",
  "preApplicationEssayMinLength",
  "preApplicationEssayMaxLength",
  "allowedEmailDomains"
)
SELECT
  'global',
  '预申请系统',
  '社区预申请与邀请码管理系统',
  'admin@example.com',
  '建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。',
  50,
  300,
  '["126.com","139.com","163.com","189.cn","aliyun.com","apache.org","deepseek.com","edu.cn","edu.hk","edu.mo","edu.tw","foxmail.com","gmail.com","gov.cn","qq.com","sina.cn","sina.com","sohu.com","xiaomi.com","yahoo.com","privaterelay.appleid.com"]'
WHERE NOT EXISTS (SELECT 1 FROM "SiteSettings" LIMIT 1);
