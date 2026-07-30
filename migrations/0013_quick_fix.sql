-- ============================================
-- اضافه کردن فیلدهای جدید به جدول orders
-- ============================================

-- بررسی و اضافه کردن فیلد payable_amount
ALTER TABLE orders ADD COLUMN payable_amount INTEGER DEFAULT 0;

-- بررسی و اضافه کردن فیلد wallet_used_amount
ALTER TABLE orders ADD COLUMN wallet_used_amount INTEGER DEFAULT 0;

-- بررسی و اضافه کردن فیلد subtotal_amount
ALTER TABLE orders ADD COLUMN subtotal_amount INTEGER DEFAULT 0;

-- بررسی و اضافه کردن فیلد notes
ALTER TABLE orders ADD COLUMN notes TEXT;

-- بررسی و اضافه کردن فیلد address_id
ALTER TABLE orders ADD COLUMN address_id INTEGER;

-- اضافه کردن ایندکس
CREATE INDEX IF NOT EXISTS idx_orders_address_id ON orders(address_id);