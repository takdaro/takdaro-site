-- ============================================
-- مایگریشن ۰۰۲۰ - سیستم اعلان‌ها (Notification System)
-- ============================================
-- تاریخ: ۱۴۰۵/۰۵/۱۴
-- توضیح: ایجاد جداول مربوط به سیستم اعلان‌ها
--         شامل تنظیمات کانال‌ها و لاگ ارسال‌ها
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. جدول تنظیمات اعلان‌ها (کانال‌ها)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL UNIQUE,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT,
  updated_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 2. جدول لاگ ارسال اعلان‌ها
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT,
  subject TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  order_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================
-- 3. ایندکس‌ها برای بهبود عملکرد
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notification_settings_channel ON notification_settings(channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_channel ON notification_logs(event_type, channel);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_order_id ON notification_logs(order_id);

-- ============================================
-- 4. درج تنظیمات پیش‌فرض برای کانال‌ها
-- ============================================
INSERT OR IGNORE INTO notification_settings (channel, is_enabled, config, created_at, updated_at)
VALUES (
  'telegram',
  0,
  '{"bot_token": "", "chat_id": ""}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO notification_settings (channel, is_enabled, config, created_at, updated_at)
VALUES (
  'email',
  0,
  '{"provider": "smtp", "host": "", "port": 587, "secure": false, "username": "", "password": "", "from_email": "", "from_name": "", "recipients": []}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO notification_settings (channel, is_enabled, config, created_at, updated_at)
VALUES (
  'sms',
  0,
  '{"provider": "", "api_key": "", "sender": "", "recipients": []}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- ============================================
-- 5. به‌روزرسانی جدول app_settings با تنظیمات جدید
-- ============================================
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('site_base_url', 'https://takedaro.com'),
  ('site_name', 'تک تجارت'),
  ('notification_enabled', 'true');

-- ============================================
-- پایان مایگریشن
-- ============================================