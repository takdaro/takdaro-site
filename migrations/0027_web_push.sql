-- ============================================
-- Migration 0027 - Web Push Notification
-- ============================================
-- ایجاد سیستم ذخیره Push Subscription
-- و اضافه کردن کانال Web Push به Notification Settings
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. جدول Subscriptionهای Web Push
-- ============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  endpoint TEXT NOT NULL UNIQUE,

  p256dh TEXT NOT NULL,

  auth TEXT NOT NULL,

  user_agent TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  last_used_at TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);


-- ============================================
-- 2. ایندکس‌های Web Push
-- ============================================

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
ON push_subscriptions(is_active);


-- ============================================
-- 3. اضافه کردن کانال Web Push
-- ============================================

INSERT OR IGNORE INTO notification_settings (
  channel,
  is_enabled,
  config,
  created_at,
  updated_at
)
VALUES (
  'web_push',
  1,
  '{
    "enabled_for_order_created": true,
    "enabled_for_order_status": true
  }',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);


-- ============================================
-- پایان Migration 0027
-- ============================================