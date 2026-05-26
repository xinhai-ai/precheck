-- ============================================
-- 完整数据库初始化脚本（基于 prisma/schema.prisma）
-- 使用方式: psql $DATABASE_URL -f scripts/001-create-auth-tables.sql
-- ============================================

-- ============================================
-- 1. 枚举类型
-- ============================================

DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BANNED', 'DELETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PENDING', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PreApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED', 'ARCHIVED', 'PENDING_REVIEW', 'ON_HOLD'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PreApplicationSource" AS ENUM ('TIEBA', 'BILIBILI', 'DOUYIN', 'XIAOHONGSHU', 'OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "PreApplicationAdminNoteAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "EmailLogStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- 2. 基础表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS "User" (
  "id"                      TEXT NOT NULL PRIMARY KEY,
  "email"                   TEXT NOT NULL UNIQUE,
  "emailVerified"           TIMESTAMP(3),
  "password"                TEXT,
  "name"                    TEXT,
  "avatar"                  TEXT,
  "role"                    "Role" NOT NULL DEFAULT 'USER',
  "status"                  "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "country"                 TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resetToken"              TEXT UNIQUE,
  "resetTokenExpiry"        TIMESTAMP(3),
  "reactivationToken"       TEXT UNIQUE,
  "reactivationTokenExpiry" TIMESTAMP(3)
);

-- OAuth 账号表
CREATE TABLE IF NOT EXISTS "Account" (
  "id"                TEXT NOT NULL PRIMARY KEY,
  "userId"            TEXT NOT NULL,
  "type"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  "trustLevel"        INTEGER,
  "providerProfile"   JSONB,
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Session 表
CREATE TABLE IF NOT EXISTS "Session" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId"       TEXT NOT NULL,
  "expires"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 邮箱验证 Token 表
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL UNIQUE,
  "expires"    TIMESTAMP(3) NOT NULL
);

-- 文章表
CREATE TABLE IF NOT EXISTS "Post" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "title"     TEXT NOT NULL,
  "content"   TEXT,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "status"    "PostStatus" NOT NULL DEFAULT 'DRAFT',
  "views"     INTEGER NOT NULL DEFAULT 0,
  "authorId"  TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 站内信表
CREATE TABLE IF NOT EXISTS "Message" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "revokedAt"   TIMESTAMP(3),
  "revokedById" TEXT,
  CONSTRAINT "Message_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Message_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 站内信收件人表
CREATE TABLE IF NOT EXISTS "MessageRecipient" (
  "messageId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "readAt"    TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("messageId", "userId")
);

-- ============================================
-- 3. 邮件相关
-- ============================================

-- 邮件 API 配置表
CREATE TABLE IF NOT EXISTS "EmailApiConfig" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "host"      TEXT NOT NULL,
  "port"      INTEGER NOT NULL DEFAULT 587,
  "user"      TEXT NOT NULL,
  "pass"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 邮件日志表
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "to"           TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "status"       "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
  "provider"     TEXT,
  "errorMessage" TEXT,
  "metadata"     JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. 系统设置
-- ============================================

CREATE TABLE IF NOT EXISTS "SiteSettings" (
  "id"                       TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
  "siteName"                 TEXT NOT NULL,
  "siteDescription"          TEXT NOT NULL,
  "contactEmail"             TEXT NOT NULL,
  "userRegistration"         BOOLEAN NOT NULL DEFAULT true,
  "oauthLogin"               BOOLEAN NOT NULL DEFAULT true,
  "emailNotifications"       BOOLEAN NOT NULL DEFAULT true,
  "postModeration"           BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMode"          BOOLEAN NOT NULL DEFAULT false,
  "adminApplicationEnabled"  BOOLEAN NOT NULL DEFAULT true,
  "userTicketsEnabled"       BOOLEAN NOT NULL DEFAULT true,
  "auditLogEnabled"          BOOLEAN NOT NULL DEFAULT false,
  "preApplicationEssayHint"  TEXT NOT NULL DEFAULT '建议 100 字左右,避免夸赞社区与版主,只说明你的目的与需求。',
  "preApplicationEssayMinLength" INTEGER NOT NULL DEFAULT 50,
  "preApplicationEssayMaxLength" INTEGER NOT NULL DEFAULT 300,
  "allowedEmailDomains"      JSONB NOT NULL DEFAULT '[]',
  "reviewTemplatesApprove"   JSONB NOT NULL DEFAULT '[]',
  "reviewTemplatesApproveNoCode" JSONB NOT NULL DEFAULT '[]',
  "reviewTemplatesReject"    JSONB NOT NULL DEFAULT '[]',
  "reviewTemplatesDispute"   JSONB NOT NULL DEFAULT '[]',
  "qqGroups"                 JSONB NOT NULL DEFAULT '[]',
  "inviteCodeUrlPrefix"      TEXT NOT NULL DEFAULT '',
  "emailProvider"            TEXT NOT NULL DEFAULT 'env',
  "selectedEmailApiConfigId" TEXT,
  "smtpHost"                 TEXT,
  "smtpPort"                 INTEGER,
  "smtpUser"                 TEXT,
  "smtpPass"                 TEXT,
  "smtpSecure"               BOOLEAN NOT NULL DEFAULT false,
  "maxResubmitCount"         INTEGER NOT NULL DEFAULT 2,
  "inviteCodeCheckApiUrl"    TEXT,
  "inviteCodeCheckApiKey"    TEXT,
  "analyticsEnabled"         BOOLEAN NOT NULL DEFAULT true,
  "umamiAnalyticsEnabled"    BOOLEAN NOT NULL DEFAULT true,
  "linuxdoAutoAdmin"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteSettings_selectedEmailApiConfigId_fkey" FOREIGN KEY ("selectedEmailApiConfigId") REFERENCES "EmailApiConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- 5. 邀请码相关
-- ============================================

-- 邀请码查询 Token 表
CREATE TABLE IF NOT EXISTS "InviteCodeQueryToken" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "token"       TEXT NOT NULL UNIQUE,
  "expiresAt"   TIMESTAMP(3),
  "queriedAt"   TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InviteCodeQueryToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 邀请码表
CREATE TABLE IF NOT EXISTS "InviteCode" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "code"           TEXT NOT NULL UNIQUE,
  "expiresAt"      TIMESTAMP(3),
  "assignedAt"     TIMESTAMP(3),
  "assignedById"   TEXT,
  "usedAt"         TIMESTAMP(3),
  "usedById"       TEXT,
  "createdById"    TEXT,
  "issuedToUserId" TEXT,
  "issuedToEmail"  TEXT,
  "issuedAt"       TIMESTAMP(3),
  "queryTokenId"   TEXT,
  "deletedAt"      TIMESTAMP(3),
  "checkValid"     BOOLEAN,
  "checkMessage"   TEXT,
  "checkedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InviteCode_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InviteCode_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InviteCode_issuedToUserId_fkey" FOREIGN KEY ("issuedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InviteCode_queryTokenId_fkey" FOREIGN KEY ("queryTokenId") REFERENCES "InviteCodeQueryToken"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- 6. 预申请相关
-- ============================================

-- 预申请表
CREATE TABLE IF NOT EXISTS "PreApplication" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "userId"         TEXT,
  "qqNumber"       TEXT,
  "essay"          TEXT NOT NULL,
  "source"         "PreApplicationSource",
  "sourceDetail"   TEXT,
  "registerEmail"  TEXT NOT NULL,
  "queryToken"     TEXT UNIQUE,
  "group"          TEXT NOT NULL,
  "status"         "PreApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "guidance"       TEXT,
  "reviewedAt"     TIMESTAMP(3),
  "reviewedById"   TEXT,
  "resubmitCount"  INTEGER NOT NULL DEFAULT 0,
  "version"        INTEGER NOT NULL DEFAULT 1,
  "inviteCodeId"   TEXT UNIQUE,
  "codeSent"       BOOLEAN NOT NULL DEFAULT false,
  "codeSentAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "holdUntil"      TIMESTAMP(3),
  CONSTRAINT "PreApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "PreApplication_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 预申请版本历史表
CREATE TABLE IF NOT EXISTS "PreApplicationVersion" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "preApplicationId" TEXT NOT NULL,
  "version"          INTEGER NOT NULL,
  "essay"            TEXT NOT NULL,
  "source"           "PreApplicationSource",
  "sourceDetail"     TEXT,
  "registerEmail"    TEXT NOT NULL,
  "group"            TEXT NOT NULL,
  "status"           "PreApplicationStatus" NOT NULL,
  "guidance"         TEXT,
  "reviewedAt"       TIMESTAMP(3),
  "reviewedById"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreApplicationVersion_preApplicationId_fkey" FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreApplicationVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 预申请草稿表（每用户一条）
CREATE TABLE IF NOT EXISTS "PreApplicationDraft" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "userId"        TEXT NOT NULL UNIQUE,
  "essay"         TEXT NOT NULL DEFAULT '',
  "source"        "PreApplicationSource",
  "sourceDetail"  TEXT,
  "registerEmail" TEXT NOT NULL DEFAULT '',
  "group"         TEXT NOT NULL DEFAULT '',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreApplicationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 预申请管理员备注表
CREATE TABLE IF NOT EXISTS "PreApplicationAdminNote" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "preApplicationId" TEXT NOT NULL,
  "content"          TEXT NOT NULL,
  "createdById"      TEXT NOT NULL,
  "updatedById"      TEXT NOT NULL,
  "deletedAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreApplicationAdminNote_preApplicationId_fkey" FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreApplicationAdminNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreApplicationAdminNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 预申请管理员备注历史表
CREATE TABLE IF NOT EXISTS "PreApplicationAdminNoteRevision" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "noteId"     TEXT NOT NULL,
  "action"     "PreApplicationAdminNoteAction" NOT NULL,
  "content"    TEXT NOT NULL,
  "editedById" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreApplicationAdminNoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "PreApplicationAdminNote"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PreApplicationAdminNoteRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 7. 审计日志
-- ============================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT,
  "action"     TEXT NOT NULL,
  "actorId"    TEXT,
  "actorName"  TEXT,
  "actorEmail" TEXT,
  "actorRole"  "Role",
  "ip"         TEXT,
  "userAgent"  TEXT,
  "before"     JSONB,
  "after"      JSONB,
  "metadata"   JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- ============================================
-- 8. 工单系统
-- ============================================

-- 工单表
CREATE TABLE IF NOT EXISTS "Ticket" (
  "id"               TEXT NOT NULL PRIMARY KEY,
  "preApplicationId" TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "subject"          TEXT NOT NULL,
  "status"           "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"       TIMESTAMP(3),
  CONSTRAINT "Ticket_preApplicationId_fkey" FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 工单消息表
CREATE TABLE IF NOT EXISTS "TicketMessage" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "ticketId"  TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 9. 聊天系统
-- ============================================

-- 公共聊天消息表
CREATE TABLE IF NOT EXISTS "ChatMessage" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "content"   TEXT NOT NULL,
  "senderId"  TEXT NOT NULL,
  "replyToId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 私信会话表
CREATE TABLE IF NOT EXISTS "PrivateChat" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "adminId"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivateChat_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 私信消息表
CREATE TABLE IF NOT EXISTS "PrivateChatMessage" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "chatId"    TEXT NOT NULL,
  "senderId"  TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"    TIMESTAMP(3),
  CONSTRAINT "PrivateChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "PrivateChat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivateChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 10. API Token
-- ============================================

CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL UNIQUE,
  "prefix"     TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"  TIMESTAMP(3),
  CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ============================================
-- 11. 补齐旧表可能缺失的列（兼容已有数据库）
-- ============================================

DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "country" TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "reactivationToken" TEXT UNIQUE; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "User" ADD COLUMN "reactivationTokenExpiry" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Account" ADD COLUMN "trustLevel" INTEGER; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Post" ADD COLUMN "status" "PostStatus" NOT NULL DEFAULT 'DRAFT'; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Post" ADD COLUMN "views" INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MessageRecipient" ADD COLUMN "deletedAt" TIMESTAMP(3); EXCEPTION WHEN duplicate_column THEN null; END $$;

-- ============================================
-- 12. 索引
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE INDEX IF NOT EXISTS "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX IF NOT EXISTS "Post_status_idx" ON "Post"("status");
CREATE INDEX IF NOT EXISTS "Message_createdById_idx" ON "Message"("createdById");
CREATE INDEX IF NOT EXISTS "Message_revokedAt_idx" ON "Message"("revokedAt");
CREATE INDEX IF NOT EXISTS "MessageRecipient_userId_readAt_idx" ON "MessageRecipient"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "MessageRecipient_userId_deletedAt_idx" ON "MessageRecipient"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EmailApiConfig_name_idx" ON "EmailApiConfig"("name");
CREATE INDEX IF NOT EXISTS "EmailLog_to_idx" ON "EmailLog"("to");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
CREATE INDEX IF NOT EXISTS "InviteCodeQueryToken_token_idx" ON "InviteCodeQueryToken"("token");
CREATE INDEX IF NOT EXISTS "InviteCodeQueryToken_createdById_idx" ON "InviteCodeQueryToken"("createdById");
CREATE INDEX IF NOT EXISTS "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "InviteCode_usedAt_idx" ON "InviteCode"("usedAt");
CREATE INDEX IF NOT EXISTS "InviteCode_issuedToUserId_idx" ON "InviteCode"("issuedToUserId");
CREATE INDEX IF NOT EXISTS "InviteCode_issuedToEmail_idx" ON "InviteCode"("issuedToEmail");
CREATE INDEX IF NOT EXISTS "InviteCode_queryTokenId_idx" ON "InviteCode"("queryTokenId");
CREATE INDEX IF NOT EXISTS "InviteCode_deletedAt_idx" ON "InviteCode"("deletedAt");
CREATE INDEX IF NOT EXISTS "InviteCode_checkValid_idx" ON "InviteCode"("checkValid");
CREATE INDEX IF NOT EXISTS "PreApplication_status_createdAt_idx" ON "PreApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PreApplication_userId_createdAt_idx" ON "PreApplication"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PreApplication_registerEmail_idx" ON "PreApplication"("registerEmail");
CREATE INDEX IF NOT EXISTS "PreApplication_qqNumber_idx" ON "PreApplication"("qqNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PreApplicationVersion_preApplicationId_version_key" ON "PreApplicationVersion"("preApplicationId", "version");
CREATE INDEX IF NOT EXISTS "PreApplicationVersion_preApplicationId_idx" ON "PreApplicationVersion"("preApplicationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PreApplicationDraft_userId_key" ON "PreApplicationDraft"("userId");
CREATE INDEX IF NOT EXISTS "PreApplicationDraft_updatedAt_idx" ON "PreApplicationDraft"("updatedAt");
CREATE INDEX IF NOT EXISTS "PreApplicationAdminNote_preApplicationId_createdAt_idx" ON "PreApplicationAdminNote"("preApplicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "PreApplicationAdminNote_createdById_createdAt_idx" ON "PreApplicationAdminNote"("createdById", "createdAt");
CREATE INDEX IF NOT EXISTS "PreApplicationAdminNote_deletedAt_idx" ON "PreApplicationAdminNote"("deletedAt");
CREATE INDEX IF NOT EXISTS "PreApplicationAdminNoteRevision_noteId_createdAt_idx" ON "PreApplicationAdminNoteRevision"("noteId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX IF NOT EXISTS "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX IF NOT EXISTS "Ticket_preApplicationId_idx" ON "Ticket"("preApplicationId");
CREATE INDEX IF NOT EXISTS "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ChatMessage_replyToId_idx" ON "ChatMessage"("replyToId");
CREATE UNIQUE INDEX IF NOT EXISTS "PrivateChat_userId_adminId_key" ON "PrivateChat"("userId", "adminId");
CREATE INDEX IF NOT EXISTS "PrivateChat_userId_idx" ON "PrivateChat"("userId");
CREATE INDEX IF NOT EXISTS "PrivateChat_adminId_idx" ON "PrivateChat"("adminId");
CREATE INDEX IF NOT EXISTS "PrivateChat_updatedAt_idx" ON "PrivateChat"("updatedAt");
CREATE INDEX IF NOT EXISTS "PrivateChatMessage_chatId_createdAt_idx" ON "PrivateChatMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "PrivateChatMessage_senderId_idx" ON "PrivateChatMessage"("senderId");
CREATE INDEX IF NOT EXISTS "ApiToken_userId_idx" ON "ApiToken"("userId");
CREATE INDEX IF NOT EXISTS "ApiToken_tokenHash_idx" ON "ApiToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "ApiToken_prefix_idx" ON "ApiToken"("prefix");

-- ============================================
-- 13. 初始管理员用户（密码: Admin123!）
-- ============================================

INSERT INTO "User" ("id", "email", "password", "name", "role", "emailVerified", "createdAt", "updatedAt")
VALUES (
  'admin',
  'admin@example.com',
  '467344d3212ce1f64f743b681e48ddf991dbbbf0976ceb5c24293cc104f547f9',
  'Administrator',
  'SUPER_ADMIN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("email") DO UPDATE
  SET "password" = EXCLUDED."password",
      "role" = 'SUPER_ADMIN',
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "User"."password" IS NULL
     OR "User"."password" = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
