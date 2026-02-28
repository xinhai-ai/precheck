-- 将默认管理员提升为 SUPER_ADMIN
-- 使用方式: psql $DATABASE_URL -f scripts/003-promote-super-admin.sql

-- 需要先添加 SUPER_ADMIN 枚举值（如果不存在）
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 将 admin 用户提升为 SUPER_ADMIN
UPDATE "User"
SET "role" = 'SUPER_ADMIN',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'admin';
