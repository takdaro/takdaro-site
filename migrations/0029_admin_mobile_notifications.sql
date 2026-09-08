-- ============================================
-- 0029_admin_mobile_notifications.sql
-- Notification مستقل اپ مدیریت Android
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. دستگاه‌های ثبت‌شده اپ مدیریت
-- ============================================
CREATE TABLE IF NOT EXISTS admin_mobile_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id INTEGER NOT NULL,

  device_id TEXT NOT NULL UNIQUE,
  push_token TEXT NOT NULL UNIQUE,

  platform TEXT NOT NULL DEFAULT 'android',
  device_name TEXT,
  app_version TEXT,

  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
);

-- ============================================
-- 2. ایندکس‌ها
-- ============================================
CREATE INDEX IF NOT EXISTS idx_admin_mobile_devices_user_id
ON admin_mobile_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_devices_active
ON admin_mobile_devices(is_active);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_devices_device_id
ON admin_mobile_devices(device_id);

-- ============================================
-- 3. لاگ مستقل Notification اپ مدیریت
-- ============================================
CREATE TABLE IF NOT EXISTS admin_mobile_notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  device_id INTEGER,
  user_id INTEGER,

  event_type TEXT NOT NULL,

  title TEXT,
  body TEXT,

  data TEXT,

  status TEXT NOT NULL DEFAULT 'pending',

  error_message TEXT,

  order_id INTEGER,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,

  FOREIGN KEY (device_id)
    REFERENCES admin_mobile_devices(id)
    ON DELETE SET NULL,

  FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE SET NULL
);

-- ============================================
-- 4. ایندکس‌های لاگ
-- ============================================
CREATE INDEX IF NOT EXISTS idx_admin_mobile_notification_logs_event
ON admin_mobile_notification_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_notification_logs_status
ON admin_mobile_notification_logs(status);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_notification_logs_created
ON admin_mobile_notification_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_mobile_notification_logs_order
ON admin_mobile_notification_logs(order_id);

-- ============================================
-- پایان Migration 0029
-- ============================================