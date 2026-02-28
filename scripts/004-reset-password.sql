-- 重置指定邮箱的密码为 Admin123!
-- 使用方式: psql $DATABASE_URL -v email="'user@example.com'" -f scripts/004-reset-password.sql
-- 注意: 重置后的密码哈希依赖 AUTH_SECRET，请确保与 .env 中一致

UPDATE "User"
SET "password" = '467344d3212ce1f64f743b681e48ddf991dbbbf0976ceb5c24293cc104f547f9',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "email" = :email;
