-- ============================================
-- اضافه کردن ستون extra_cost به جدول shipping_costs
-- ============================================

-- اضافه کردن ستون extra_cost (هزینه مازاد)
ALTER TABLE shipping_costs ADD COLUMN extra_cost INTEGER NOT NULL DEFAULT 0;

-- به‌روزرسانی داده‌های موجود: extra_cost را برابر 0 قرار بده
UPDATE shipping_costs SET extra_cost = 0;

-- به‌روزرسانی داده‌های قدیمی: اگر cost_type برابر extra نیست، extra_cost = 0
-- اگر داده‌ای با cost_type = 'extra' وجود دارد، extra_cost را برابر cost_amount قرار بده
UPDATE shipping_costs SET extra_cost = cost_amount WHERE cost_type = 'extra';