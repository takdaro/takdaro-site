-- ============================================
-- اضافه کردن 5 وضعیت جدید به sms_templates
-- ============================================

INSERT OR IGNORE INTO sms_templates (event_type, title, message_template, is_enabled) 
VALUES 
('order_created', 'سفارش ثبت شد', '🛍️ سفارش شما با موفقیت ثبت شد\nشماره: {order_number}\nمبلغ: {amount} تومان\n\nشرکت تک تجارت\nwww.takdaro.com', 1),

('payment_pending', 'در انتظار پرداخت', '💳 در انتظار پرداخت\nسفارش: {order_number}\nمبلغ: {amount} تومان\n\nلطفاً برای تکمیل سفارش، نسبت به پرداخت اقدام کنید.\n\nشرکت تک تجارت\nwww.takdaro.com', 1),

('payment_success', 'پرداخت موفق', '✅ پرداخت موفق\nسفارش: {order_number}\nمبلغ: {amount} تومان\n\nشرکت تک تجارت\nwww.takdaro.com', 1),

('payment_failed', 'پرداخت ناموفق', '❌ پرداخت ناموفق\nسفارش: {order_number}\nمبلغ: {amount} تومان\n\nدر صورت نیاز، مجدداً اقدام به پرداخت کنید.\n\nشرکت تک تجارت\nwww.takdaro.com', 1),

('payment_review', 'بررسی پرداخت', '⏳ در انتظار تأیید پرداخت\nسفارش: {order_number}\nمبلغ: {amount} تومان\n\nپس از تأیید، وضعیت سفارش به‌روزرسانی می‌شود.\n\nشرکت تک تجارت\nwww.takdaro.com', 1);