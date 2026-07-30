-- ============================================
-- اضافه کردن فیلدهای جدید به جدول orders
-- ============================================

-- 1. اضافه کردن فیلد payable_amount
ALTER TABLE orders ADD COLUMN payable_amount INTEGER DEFAULT 0;

-- 2. اضافه کردن فیلد wallet_used_amount (اگر وجود ندارد)
ALTER TABLE orders ADD COLUMN wallet_used_amount INTEGER DEFAULT 0;

-- 3. اضافه کردن فیلد subtotal_amount (اگر وجود ندارد)
ALTER TABLE orders ADD COLUMN subtotal_amount INTEGER DEFAULT 0;

-- 4. اضافه کردن فیلد notes (اگر وجود ندارد)
ALTER TABLE orders ADD COLUMN notes TEXT;

-- 5. اضافه کردن فیلد address_id (اگر وجود ندارد)
ALTER TABLE orders ADD COLUMN address_id INTEGER;

-- 6. اضافه کردن ایندکس‌ها
CREATE INDEX IF NOT EXISTS idx_orders_address_id ON orders(address_id);

-- ============================================
-- به‌روزرسانی تنظیمات پیش‌فرض فاکتور
-- ============================================
INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invoice_logo', ''),
  ('invoice_thankyou_text', 'سپاس‌گزاریم که از تک تجارت خرید کردید. سفارش شما با موفقیت ثبت شد.'),
  ('invoice_bank_account', 'بانک ملی - شماره حساب: ۱۲۳۴۵۶۷۸۹۰'),
  ('invoice_card_number', '۶۰۳۷-۷۹۹۱-۵۰۵۴-۴۳۴۲'),
  ('invoice_sheba_number', 'IR۴۵۰۱۷۰۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰'),
  ('invoice_payment_deadline', '۲۴ ساعت'),
  ('invoice_payment_description', 'لطفاً مبلغ فاکتور را به شماره کارت درج شده واریز و تصویر رسید را به شماره واتساپ پشتیبانی ارسال کنید.'),
  ('invoice_whatsapp_number', '۰۹۱۲۳۴۵۶۷۸۹'),
  ('invoice_company_name', 'تک تجارت'),
  ('invoice_company_phone', '۰۲۱-۱۲۳۴۵۶۷۸'),
  ('invoice_company_address', 'تهران، خیابان ولیعصر، پلاک ۱۲۳');