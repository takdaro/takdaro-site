-- ============================================
-- اضافه کردن ستون default_cost به جدول shipping_methods
-- ============================================

-- اضافه کردن ستون
ALTER TABLE shipping_methods ADD COLUMN default_cost INTEGER NOT NULL DEFAULT 0;

-- به‌روزرسانی داده‌های موجود با هزینه‌های پیش‌فرض
UPDATE shipping_methods SET default_cost = 120000 WHERE slug = 'post';
UPDATE shipping_methods SET default_cost = 150000 WHERE slug = 'tipax';
UPDATE shipping_methods SET default_cost = 200000 WHERE slug = 'snap-box';
UPDATE shipping_methods SET default_cost = 180000 WHERE slug = 'freight';
UPDATE shipping_methods SET default_cost = 250000 WHERE slug = 'custom';