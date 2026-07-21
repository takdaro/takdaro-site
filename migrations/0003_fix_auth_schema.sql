PRAGMA defer_foreign_keys = true;

ALTER TABLE users RENAME COLUMN mobile TO phone;

DROP INDEX IF EXISTS idx_users_mobile;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- اگر جدول sessions همین حالا درست است، این بخش را لازم نیست تغییر بدهی.
-- فقط برای اطمینان از وجود ایندکس:
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);