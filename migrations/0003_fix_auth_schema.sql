PRAGMA defer_foreign_keys = true;

-- ============================================
-- Migration 0003 - اصلاح ساختار احراز هویت
-- ============================================
-- در Migration 0001 ستون phone از ابتدا ایجاد شده است.
-- بنابراین نیازی به تغییر mobile به phone وجود ندارد.
-- ============================================

-- اطمینان از وجود ایندکس شماره تلفن
CREATE INDEX IF NOT EXISTS idx_users_phone
ON users(phone);

-- اطمینان از وجود ایندکس ایمیل
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

-- اطمینان از وجود ایندکس session
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);
