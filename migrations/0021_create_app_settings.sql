-- ============================================
-- ایجاد جدول app_settings
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- درج تنظیمات اولیه
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('site_base_url', 'https://takedaro.com'),
  ('site_name', 'تک تجارت'),
  ('notification_enabled', 'true');