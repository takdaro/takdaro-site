-- ============================================
-- مایگریشن ۰۰۲۶ - اصلاح تنظیمات SMS برای ۱۶ وضعیت
-- تاریخ: 2026-08-21
-- ============================================

-- 1. اصلاح نام event_type از order_processing به processing
UPDATE sms_templates 
SET event_type = 'processing' 
WHERE event_type = 'order_processing';

-- 2. اضافه کردن ستون‌های جدید به sms_settings برای همه ۱۶ وضعیت

-- ستون‌های مربوط به وضعیت‌های سفارش
ALTER TABLE sms_settings ADD COLUMN event_order_confirmed_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_processing_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_ready_to_ship_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_courier_delivery_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_bus_shipping_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_shipped_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_delivered_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_completed_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_cancelled_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_returned_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_processing_failed_user INTEGER DEFAULT 1;

-- ستون‌های مربوط به وضعیت‌های پرداخت
ALTER TABLE sms_settings ADD COLUMN event_payment_pending_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_payment_failed_user INTEGER DEFAULT 1;
ALTER TABLE sms_settings ADD COLUMN event_payment_review_user INTEGER DEFAULT 1;

-- 3. به‌روزرسانی مقادیر پیش‌فرض برای رکورد موجود
UPDATE sms_settings 
SET 
    event_order_confirmed_user = 1,
    event_processing_user = 1,
    event_ready_to_ship_user = 1,
    event_courier_delivery_user = 1,
    event_bus_shipping_user = 1,
    event_shipped_user = 1,
    event_delivered_user = 1,
    event_completed_user = 1,
    event_cancelled_user = 1,
    event_returned_user = 1,
    event_processing_failed_user = 1,
    event_payment_pending_user = 1,
    event_payment_failed_user = 1,
    event_payment_review_user = 1
WHERE id = 1;

-- 4. غیرفعال کردن کلید کلی قدیمی (دیگر استفاده نمی‌شود)
UPDATE sms_settings 
SET event_order_status_changed_user = 0 
WHERE id = 1;

-- ============================================
-- پایان مایگریشن
-- ============================================