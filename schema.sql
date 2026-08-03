-- ============================================
-- تک تجارت | ساختار دیتابیس نسخه نهایی
-- ============================================

-- ============================================
-- 1. کاربران
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  wallet_balance INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. نشست‌ها
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. آدرس‌ها
-- ============================================
CREATE TABLE IF NOT EXISTS user_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'shipping',
  full_name TEXT NOT NULL,
  address_line TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 4. سفارش‌ها (نسخه کامل با فیلدهای فاکتور)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_number TEXT NOT NULL UNIQUE,
  address_id INTEGER,
  
  -- وضعیت‌ها
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  
  -- مبالغ
  subtotal_amount INTEGER NOT NULL DEFAULT 0,
  shipping_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  wallet_used_amount INTEGER NOT NULL DEFAULT 0,
  payable_amount INTEGER NOT NULL DEFAULT 0,
  
  -- کش‌بک
  cashback_amount INTEGER NOT NULL DEFAULT 0,
  cashback_status TEXT NOT NULL DEFAULT 'none',
  
  -- یادداشت
  notes TEXT,
  
  -- زمان‌ها
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (address_id) REFERENCES user_addresses(id) ON DELETE SET NULL
);

-- ============================================
-- 5. آیتم‌های سفارش
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,
  total_price INTEGER NOT NULL DEFAULT 0,
  -- ⭐ فیلدهای جدید برای ذخیره نرخ لحظه‌ای
  rate_at_purchase INTEGER,
  currency_code TEXT DEFAULT 'USD',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- ============================================
-- 6. تراکنش‌های کیف پول
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- credit, debit, cashback, refund, adjustment
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  source TEXT,
  description TEXT,
  note TEXT,
  order_id INTEGER,
  order_number TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 7. تنظیمات برنامه (شامل تنظیمات فاکتور)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. لاگ‌های ادمین
-- ============================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 9. محصولات (نسخه به‌روز شده با قیمت‌گذاری وابسته به نرخ ارز)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  price INTEGER,
  price_label TEXT DEFAULT 'تماس بگیرید',
  show_price INTEGER NOT NULL DEFAULT 1,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 1,
  stock_label TEXT DEFAULT 'موجود',
  short_description TEXT,
  description TEXT,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  images TEXT,
  primary_image TEXT,
  -- ⭐ فیلدهای جدید سیستم نرخ ارز
  price_type TEXT DEFAULT 'fixed',
  base_price INTEGER,
  profit_type TEXT DEFAULT 'none',
  profit_value INTEGER,
  fixed_fee INTEGER,
  rounding_type TEXT DEFAULT 'none',
  rounding_method TEXT DEFAULT 'nearest',
  calculated_price INTEGER,
  price_calculated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 10. تصاویر محصولات
-- ============================================
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 11. روش‌های حمل‌ونقل
-- ============================================
CREATE TABLE IF NOT EXISTS shipping_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  delivery_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. هزینه ارسال بر اساس استان و شهر
-- ============================================
CREATE TABLE IF NOT EXISTS shipping_costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  shipping_method_id INTEGER NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'fixed',
  cost_amount INTEGER NOT NULL DEFAULT 0,
  delivery_time TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE,
  UNIQUE(province, city, shipping_method_id)
);

-- ============================================
-- 13. ارسال رایگان بر اساس مبلغ سفارش
-- ============================================
CREATE TABLE IF NOT EXISTS shipping_free_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipping_method_id INTEGER NOT NULL,
  min_order_amount INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE
);

-- ============================================
-- 14. نرخ‌های ارز (جدید)
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
-- 15. تاریخچه نرخ‌های ارز (جدید)
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
-- ایندکس‌ها
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_cashback_status ON orders(cashback_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_price_type ON products(price_type);
CREATE INDEX IF NOT EXISTS idx_products_calculated_price ON products(calculated_price);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_shipping_costs_province_city ON shipping_costs(province, city);
CREATE INDEX IF NOT EXISTS idx_shipping_costs_method ON shipping_costs(shipping_method_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_active ON shipping_methods(is_active);

CREATE INDEX IF NOT EXISTS idx_rates_currency_code ON rates(currency_code);
CREATE INDEX IF NOT EXISTS idx_rates_is_active ON rates(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_history_rate_id ON rate_history(rate_id);
CREATE INDEX IF NOT EXISTS idx_rate_history_created_at ON rate_history(created_at);

-- ============================================
-- تنظیمات پیش‌فرض فاکتور و پرداخت
-- ============================================
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invoice_logo', ''),
  ('invoice_thankyou_text', 'سپاس‌گزاریم که از تک تجارت خرید کردید. سفارش شما با موفقیت ثبت شد.'),
  ('invoice_bank_account', 'بانک ملی - شماره حساب: ۱۲۳۴۵۶۷۸۹۰'),
  ('invoice_card_number', '۶۰۳۷‑۷۹۹۱‑۵۰۵۴‑۴۳۴۲'),
  ('invoice_sheba_number', 'IR۴۵۰۱۷۰۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰'),
  ('invoice_payment_deadline', '۲۴ ساعت'),
  ('invoice_payment_description', 'لطفاً مبلغ فاکتور را به شماره کارت درج شده واریز و تصویر رسید را به شماره واتساپ پشتیبانی ارسال کنید.'),
  ('invoice_whatsapp_number', '۰۹۱۲۳۴۵۶۷۸۹'),
  ('invoice_company_name', 'تک تجارت'),
  ('invoice_company_phone', '۰۲۱‑۱۲۳۴۵۶۷۸'),
  ('invoice_company_address', 'تهران، خیابان ولیعصر، پلاک ۱۲۳'),
  ('cashback_percent', '0'),
  ('cashback_statuses', 'completed'),
  ('allow_public_registration', 'true');

-- ============================================
-- درج نرخ پیش‌فرض دلار
-- ============================================
INSERT OR IGNORE INTO rates (currency_code, currency_name, rate, source_type, is_active)
VALUES ('USD', 'دلار آمریکا', 196000, 'manual', 1);