-- ============================================
-- مایگریشن ۰۰۲۳ - توکن‌های اتصال تلگرام
-- ============================================
-- تاریخ: ۱۴۰۵/۰۵/۱۵
-- توضیح: ایجاد جدول توکن‌های یکبارمصرف برای اتصال امن تلگرام
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. جدول توکن‌های اتصال تلگرام
-- ============================================
CREATE TABLE IF NOT EXISTS telegram_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  is_used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT DEFAULT (datetime('now', '+10 minutes')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 2. ایندکس‌ها
-- ============================================
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_token_hash ON telegram_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_user_id ON telegram_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_expires_at ON telegram_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_is_used ON telegram_tokens(is_used);

-- ============================================
-- پایان مایگریشن
-- ============================================