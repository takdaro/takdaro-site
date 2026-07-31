-- ============================================
-- سیستم حمل‌ونقل | تک تجارت
-- ============================================

-- ============================================
-- 1. روش‌های حمل‌ونقل
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
-- 2. استان‌ها و شهرها با هزینه ارسال
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
-- 3. ارسال رایگان بر اساس مبلغ سفارش
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
-- 4. ایندکس‌ها
-- ============================================
CREATE INDEX IF NOT EXISTS idx_shipping_costs_province_city ON shipping_costs(province, city);
CREATE INDEX IF NOT EXISTS idx_shipping_costs_method ON shipping_costs(shipping_method_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_active ON shipping_methods(is_active);

-- ============================================
-- 5. داده‌های اولیه - روش‌های حمل‌ونقل
-- ============================================
INSERT OR IGNORE INTO shipping_methods (name, slug, description, delivery_time, is_active, sort_order) VALUES
  ('پست پیشتاز', 'post', 'ارسال از طریق پست پیشتاز', '۳ تا ۵ روز کاری', 1, 1),
  ('تیپاکس', 'tipax', 'ارسال از طریق تیپاکس', '۲ تا ۳ روز کاری', 1, 2),
  ('پیک موتوری', 'motor', 'ارسال با پیک موتوری (فقط تهران)', 'همان روز', 1, 3),
  ('ارسال اختصاصی', 'custom', 'ارسال اختصاصی با هماهنگی قبلی', '۱ تا ۲ روز کاری', 1, 4);

-- ============================================
-- 6. داده‌های اولیه - هزینه‌های ارسال (بخش 1 - تهران و البرز)
-- ============================================

-- تهران
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'تهران', id, 'fixed', 120000, '۱ تا ۲ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'تهران', id, 'fixed', 150000, '۱ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'تهران', id, 'fixed', 200000, 'همان روز', 1 FROM shipping_methods WHERE slug = 'motor';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'ری', id, 'fixed', 120000, '۱ تا ۲ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'شهریار', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'اسلامشهر', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'ورامین', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'شمیرانات', id, 'fixed', 120000, '۱ تا ۲ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'رباط‌کریم', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'پاکدشت', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'دماوند', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'فیروزکوه', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'قدس', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'ملارد', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'قرچک', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'تهران', 'پردیس', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ============================================
-- 7. داده‌های اولیه - هزینه‌های ارسال (بخش 2 - البرز و اصفهان)
-- ============================================

-- البرز
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'کرج', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'کرج', id, 'fixed', 160000, '۱ تا ۲ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'فردیس', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'نظرآباد', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'هشتگرد', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'محمدشهر', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'کمالشهر', id, 'fixed', 130000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'ماهدشت', id, 'fixed', 140000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'البرز', 'اشتهارد', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- اصفهان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'اصفهان', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'اصفهان', id, 'fixed', 180000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'کاشان', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'خمینی‌شهر', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'نجف‌آباد', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'شاهین‌شهر', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'شهرضا', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'فلاورجان', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'مبارکه', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'لنجان', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'گلپایگان', id, 'fixed', 170000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'نطنز', id, 'fixed', 170000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اصفهان', 'سمیرم', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ============================================
-- 8. داده‌های اولیه - هزینه‌های ارسال (بخش 3 - فارس و خراسان رضوی)
-- ============================================

-- فارس
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'شیراز', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'شیراز', id, 'fixed', 190000, '۲ تا ۳ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'مرودشت', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'جهرم', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'فسا', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'کازرون', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'لار', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'داراب', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'آباده', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'نورآباد', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'فیروزآباد', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'استهبان', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'اقلید', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'فارس', 'نی‌ریز', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- خراسان رضوی
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'مشهد', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'مشهد', id, 'fixed', 200000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'نیشابور', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'سبزوار', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'تربت حیدریه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'قوچان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'کاشمر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'تربت جام', id, 'fixed', 190000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'گناباد', id, 'fixed', 190000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'چناران', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'فریمان', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'درگز', id, 'fixed', 190000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان رضوی', 'خواف', id, 'fixed', 190000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ============================================
-- 9. داده‌های اولیه - هزینه‌های ارسال (بخش 4 - آذربایجان شرقی)
-- ============================================

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'تبریز', id, 'fixed', 160000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'تبریز', id, 'fixed', 190000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'tipax';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'مراغه', id, 'fixed', 160000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'مرند', id, 'fixed', 160000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'میانه', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'اهر', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'بناب', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'سراب', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'شبستر', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'جلفا', id, 'fixed', 180000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان شرقی', 'اسکو', id, 'fixed', 170000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ============================================
-- 10. داده‌های اولیه - هزینه‌های ارسال (بخش 5 - سایر استان‌ها)
-- ============================================

-- آذربایجان غربی
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'ارومیه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'خوی', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'مهاباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'میاندوآب', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'بوکان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'سلماس', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'پیرانشهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'نقده', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'ماکو', id, 'fixed', 190000, '۴ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'آذربایجان غربی', 'شاهین‌دژ', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- اردبیل
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'اردبیل', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'پارس‌آباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'مشگین‌شهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'خلخال', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'گرمی', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'نمین', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'نیر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'اردبیل', 'بیله‌سوار', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ایلام
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'ایلام', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'دهلران', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'مهران', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'آبدانان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'دره‌شهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'ایوان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'ایلام', 'سرابله', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- بوشهر
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'بوشهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'برازجان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'گناوه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'کنگان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'دیر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'عسلویه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'خورموج', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'بوشهر', 'جم', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- چهارمحال و بختیاری
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'شهرکرد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'بروجن', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'فارسان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'لردگان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'سامان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'فرخ‌شهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'هفشجان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'چهارمحال و بختیاری', 'اردل', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- خراسان جنوبی
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'بیرجند', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'قائن', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'طبس', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'فردوس', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'نهبندان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'سربیشه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'بشرویه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان جنوبی', 'سرایان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- خراسان شمالی
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'بجنورد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'شیروان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'اسفراین', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'جاجرم', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'آشخانه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'فاروج', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خراسان شمالی', 'گرمه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- خوزستان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'اهواز', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'آبادان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'خرمشهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'دزفول', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'اندیمشک', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'ماهشهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'بندر امام خمینی', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'شوشتر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'شوش', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'بهبهان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'ایذه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'مسجدسلیمان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'خوزستان', 'رامهرمز', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- زنجان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'زنجان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'ابهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'خرمدره', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'قیدار', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'طارم', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'ماهنشان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'زنجان', 'سلطانیه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- سمنان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'سمنان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'شاهرود', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'دامغان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'گرمسار', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'مهدی‌شهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'آرادان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سمنان', 'سرخه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- سیستان و بلوچستان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'زاهدان', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'چابهار', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'زابل', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'ایرانشهر', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'سراوان', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'خاش', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'کنارک', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'نیک‌شهر', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'راسک', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'سیستان و بلوچستان', 'بمپور', id, 'fixed', 190000, '۴ تا ۶ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- قزوین
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'قزوین', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'تاکستان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'آبیک', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'الوند', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'محمدیه', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'بوئین‌زهرا', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قزوین', 'آبگرم', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- قم
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قم', 'قم', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قم', 'جعفریه', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قم', 'کهک', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'قم', 'سلفچگان', id, 'fixed', 150000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- کردستان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'سنندج', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'سقز', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'مریوان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'بانه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'قروه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'بیجار', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'کامیاران', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کردستان', 'دیواندره', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- کرمان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'کرمان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'سیرجان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'رفسنجان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'جیرفت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'بم', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'زرند', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'شهربابک', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'بافت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'بردسیر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'کهنوج', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمان', 'عنبرآباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- کرمانشاه
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'کرمانشاه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'اسلام‌آباد غرب', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'پاوه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'جوانرود', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'سرپل‌ذهاب', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'کنگاور', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'صحنه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'هرسین', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کرمانشاه', 'قصرشیرین', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- کهگیلویه و بویراحمد
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کهگیلویه و بویراحمد', 'یاسوج', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کهگیلویه و بویراحمد', 'دوگنبدان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کهگیلویه و بویراحمد', 'دهدشت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کهگیلویه و بویراحمد', 'لیکک', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'کهگیلویه و بویراحمد', 'سی‌سخت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- گلستان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'گرگان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'گنبد کاووس', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'علی‌آباد کتول', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'بندر ترکمن', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'کردکوی', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'آزادشهر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'مینودشت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'آق‌قلا', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گلستان', 'کلاله', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- گیلان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'رشت', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'بندر انزلی', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'لاهیجان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'لنگرود', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'آستارا', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'رودسر', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'تالش', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'صومعه‌سرا', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'فومن', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'رودبار', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'گیلان', 'آستانه اشرفیه', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- لرستان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'خرم‌آباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'بروجرد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'دورود', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'کوهدشت', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'الیگودرز', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'نورآباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'الشتر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'پلدختر', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'لرستان', 'ازنا', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- مازندران
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'ساری', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'بابل', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'آمل', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'قائم‌شهر', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'بهشهر', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'چالوس', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'نوشهر', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'تنکابن', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'رامسر', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'بابلسر', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'محمودآباد', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'نکا', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'نور', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مازندران', 'فریدونکنار', id, 'fixed', 160000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- مرکزی
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'اراک', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'ساوه', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'خمین', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'محلات', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'دلیجان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'شازند', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'تفرش', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'آشتیان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'مرکزی', 'زرندیه', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- هرمزگان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'بندرعباس', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'میناب', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'بندرلنگه', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'قشم', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'کیش', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'رودان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'حاجی‌آباد', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'جاسک', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'پارسیان', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'هرمزگان', 'بستک', id, 'fixed', 180000, '۳ تا ۵ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- همدان
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'همدان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'ملایر', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'نهاوند', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'تویسرکان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'اسدآباد', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'کبودرآهنگ', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'رزن', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'همدان', 'فامنین', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- یزد
INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'یزد', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'میبد', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'اردکان', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'بافق', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'مهریز', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'تفت', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'ابرکوه', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'اشکذر', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

INSERT OR IGNORE INTO shipping_costs (province, city, shipping_method_id, cost_type, cost_amount, delivery_time, is_active)
SELECT 'یزد', 'بهاباد', id, 'fixed', 170000, '۳ تا ۴ روز کاری', 1 FROM shipping_methods WHERE slug = 'post';

-- ============================================
-- 11. تنظیمات پیش‌فرض حمل‌ونقل
-- ============================================
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('shipping_free_threshold', '3000000'),
  ('shipping_default_method', 'post'),
  ('shipping_calculation_type', 'dynamic');