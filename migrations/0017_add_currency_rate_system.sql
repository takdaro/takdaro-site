-- ============================================
-- مایگریشن ۰۰۱۷ - سیستم مدیریت نرخ ارز و قیمت‌گذاری وابسته به دلار
-- ============================================
-- تاریخ: ۱۴۰۵/۰۵/۱۲
-- توضیح: اضافه کردن فیلدهای قیمت‌گذاری به جدول products،
--         ایجاد جداول نرخ ارز و تاریخچه
-- ============================================

PRAGMA foreign_keys = ON;

-- ============================================
-- 1. اضافه کردن فیلدهای جدید به جدول products
-- ============================================

-- قیمت‌گذاری وابسته به نرخ ارز
ALTER TABLE products ADD COLUMN price_type TEXT DEFAULT 'fixed';
-- مقادیر: 'fixed' | 'rate_based'

-- قیمت پایه به دلار (برای محصولات rate_based)
ALTER TABLE products ADD COLUMN base_price INTEGER;

-- نوع سود: 'none' | 'percentage' | 'fixed'
ALTER TABLE products ADD COLUMN profit_type TEXT DEFAULT 'none';

-- مقدار سود (درصد یا عدد ثابت)
ALTER TABLE products ADD COLUMN profit_value INTEGER;

-- هزینه ثابت اضافی (به تومان)
ALTER TABLE products ADD COLUMN fixed_fee INTEGER;

-- نوع گرد کردن: 'none' | '1000' | '10000' | '100000'
ALTER TABLE products ADD COLUMN rounding_type TEXT DEFAULT 'none';

-- روش گرد کردن: 'up' | 'down' | 'nearest'
ALTER TABLE products ADD COLUMN rounding_method TEXT DEFAULT 'nearest';

-- قیمت محاسبه‌شده آخرین بار (برای کش و نمایش سریع)
ALTER TABLE products ADD COLUMN calculated_price INTEGER;

-- زمان آخرین محاسبه قیمت
ALTER TABLE products ADD COLUMN price_calculated_at TEXT;


-- ============================================
-- 2. ایجاد جدول نرخ‌های ارز
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
-- 3. ایجاد جدول تاریخچه نرخ‌ها
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
-- 4. اضافه کردن فیلدهای جدید به order_items
-- برای ذخیره نرخ لحظه‌ای در زمان ثبت سفارش
-- ============================================
ALTER TABLE order_items ADD COLUMN rate_at_purchase INTEGER;
ALTER TABLE order_items ADD COLUMN currency_code TEXT DEFAULT 'USD';


-- ============================================
-- 5. درج نرخ پیش‌فرض دلار
-- ============================================
INSERT OR IGNORE INTO rates (currency_code, currency_name, rate, source_type, is_active)
VALUES ('USD', 'دلار آمریکا', 196000, 'manual', 1);


-- ============================================
-- 6. ایندکس‌ها
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rates_currency_code ON rates(currency_code);
CREATE INDEX IF NOT EXISTS idx_rates_is_active ON rates(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_history_rate_id ON rate_history(rate_id);
CREATE INDEX IF NOT EXISTS idx_rate_history_created_at ON rate_history(created_at);
CREATE INDEX IF NOT EXISTS idx_products_price_type ON products(price_type);
CREATE INDEX IF NOT EXISTS idx_products_calculated_price ON products(calculated_price);


-- ============================================
-- 7. به‌روزرسانی محصولات موجود (اختیاری)
-- همه محصولات فعلی به‌عنوان 'fixed' باقی می‌مانند
-- ============================================
-- هیچ تغییری در محصولات موجود اعمال نمی‌شود
-- تا قیمت‌های فعلی دستی نخورند