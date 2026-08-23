-- ============================================
-- مایگریشن ۰۰۱۸ - رفع سیستم مدیریت نرخ ارز
-- ============================================
-- تاریخ: ۱۴۰۵/۰۵/۱۳
-- توضیح:
--   این Migration ادامه Migration 0017 است.
--------------------------------------------

--   Migration 0017 قبلاً ستون‌های زیر را ایجاد کرده است:
--   products:
--     price_type
--     base_price
--     profit_type
--     profit_value
--     fixed_fee
--     rounding_type
--     rounding_method
--     calculated_price
--     price_calculated_at
--------------------------

--   order_items:
--     rate_at_purchase
--     currency_code
--------------------

-- بنابراین این Migration نباید این ستون‌ها را دوباره ایجاد کند.
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. ایجاد جدول نرخ‌های ارز
-- ============================================

CREATE TABLE IF NOT EXISTS rates (
id INTEGER PRIMARY KEY AUTOINCREMENT,
currency_code TEXT NOT NULL UNIQUE,
currency_name TEXT NOT NULL,
rate INTEGER NOT NULL,
source_type TEXT NOT NULL DEFAULT 'manual',
is_active INTEGER NOT NULL DEFAULT 1,
updated_by_user_id INTEGER,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
CHECK (is_active IN (0, 1))
);

-- ============================================
-- 2. ایجاد جدول تاریخچه نرخ‌ها
-- ============================================

CREATE TABLE IF NOT EXISTS rate_history (
id INTEGER PRIMARY KEY AUTOINCREMENT,
rate_id INTEGER NOT NULL,
rate INTEGER NOT NULL,
source_type TEXT NOT NULL,
changed_by_user_id INTEGER,
created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (rate_id) REFERENCES rates(id) ON DELETE CASCADE,
FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 3. درج نرخ پیش‌فرض دلار
-- ============================================

INSERT OR IGNORE INTO rates (
currency_code,
currency_name,
rate,
source_type,
is_active
)
VALUES (
'USD',
'دلار آمریکا',
196000,
'manual',
1
);

-- ============================================
-- 4. ایندکس‌های جدول rates
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rates_currency_code
ON rates(currency_code);

CREATE INDEX IF NOT EXISTS idx_rates_is_active
ON rates(is_active);

-- ============================================
-- 5. ایندکس‌های جدول rate_history
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rate_history_rate_id
ON rate_history(rate_id);

CREATE INDEX IF NOT EXISTS idx_rate_history_created_at
ON rate_history(created_at);

-- ============================================
-- 6. ایندکس‌های محصولات مرتبط با قیمت‌گذاری
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_price_type
ON products(price_type);

CREATE INDEX IF NOT EXISTS idx_products_calculated_price
ON products(calculated_price);

-- ============================================
-- پایان Migration 0018
-- ============================================
