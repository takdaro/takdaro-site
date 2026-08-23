-- ============================================
-- مایگریشن ۰۰۲۲ - سیستم تلگرام کاربران
-- ============================================
-- تاریخ: ۱۴۰۵/۰۵/۱۵
-- توضیح: اضافه کردن قابلیت اتصال تلگرام به حساب کاربری
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. جدول اتصالات تلگرام کاربران
-- ============================================
CREATE TABLE IF NOT EXISTS user_telegram_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  chat_id TEXT NOT NULL UNIQUE,
  telegram_user_id TEXT,
  telegram_username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active INTEGER DEFAULT 1,
  connected_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  disconnected_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 2. جدول تنظیمات اعلان کاربران
-- ============================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  order_created INTEGER DEFAULT 1,
  payment_success INTEGER DEFAULT 1,
  payment_failed INTEGER DEFAULT 1,
  order_status_changed INTEGER DEFAULT 1,
  order_preparing INTEGER DEFAULT 1,
  order_shipped INTEGER DEFAULT 1,
  tracking_code_added INTEGER DEFAULT 1,
  order_completed INTEGER DEFAULT 1,
  order_cancelled INTEGER DEFAULT 1,
  announcements INTEGER DEFAULT 0,
  promotions INTEGER DEFAULT 0,
  marketing INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. ایندکس‌ها برای بهبود عملکرد
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_telegram_user_id ON user_telegram_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_telegram_chat_id ON user_telegram_connections(chat_id);
CREATE INDEX IF NOT EXISTS idx_user_telegram_active ON user_telegram_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_notification_preferences(user_id);

-- ============================================
-- پایان مایگریشن
-- ============================================