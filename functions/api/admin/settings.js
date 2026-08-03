import { getCurrentUser, requireAdmin } from "../../lib/admin";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

// ============================================
// GET - دریافت تنظیمات
// ============================================
export async function onRequestGet(context) {
  try {
    const user = await getCurrentUser(context);

    const result = await context.env.DB.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'invoice_%'
         OR setting_key IN (
           'cashback_percent', 
           'cashback_statuses', 
           'allow_public_registration',
           'rate_default_currency',
           'rate_api_provider',
           'rate_api_url',
           'rate_api_key',
           'rate_update_interval',
           'rate_auto_update_enabled'
         )
    `).all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    const settings = {};

    for (const row of rows) {
      settings[String(row.setting_key || "").trim()] = String(row.setting_value || "").trim();
    }

    // تنظیمات پیش‌فرض برای فیلدهای خالی
    const defaults = {
      invoice_logo: '',
      invoice_thankyou_text: 'سپاس‌گزاریم که از تک تجارت خرید کردید. سفارش شما با موفقیت ثبت شد.',
      invoice_bank_account: 'بانک ملی - شماره حساب: ۱۲۳۴۵۶۷۸۹۰',
      invoice_card_number: '۶۰۳۷-۷۹۹۱-۵۰۵۴-۴۳۴۲',
      invoice_sheba_number: 'IR۴۵۰۱۷۰۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰',
      invoice_payment_deadline: '۲۴ ساعت',
      invoice_payment_description: 'لطفاً مبلغ فاکتور را به شماره کارت درج شده واریز و تصویر رسید را به شماره واتساپ پشتیبانی ارسال کنید.',
      invoice_whatsapp_number: '۰۹۱۲۳۴۵۶۷۸۹',
      invoice_company_name: 'تک تجارت',
      invoice_company_phone: '۰۲۱-۱۲۳۴۵۶۷۸',
      invoice_company_address: 'تهران، خیابان ولیعصر، پلاک ۱۲۳',
      allow_public_registration: 'true',
      // ⭐ تنظیمات پیش‌فرض نرخ ارز
      rate_default_currency: 'USD',
      rate_api_provider: 'tgju',
      rate_api_url: 'https://api.tgju.org/v1/market/price/price_dollar_rl',
      rate_api_key: '',
      rate_update_interval: '3600',
      rate_auto_update_enabled: 'false'
    };

    // ترکیب تنظیمات با پیش‌فرض‌ها
    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (!settings[key] || settings[key] === '') {
        settings[key] = defaultValue;
      }
    }

    return json({
      success: true,
      settings
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}

// ============================================
// POST - ذخیره تنظیمات (فقط ادمین)
// ============================================
export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await context.request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "invalid_payload" }, 400);
    }

    // فیلدهای مجاز برای ذخیره
    const allowedKeys = [
      'invoice_logo',
      'invoice_thankyou_text',
      'invoice_bank_account',
      'invoice_card_number',
      'invoice_sheba_number',
      'invoice_payment_deadline',
      'invoice_payment_description',
      'invoice_whatsapp_number',
      'invoice_company_name',
      'invoice_company_phone',
      'invoice_company_address',
      'allow_public_registration',
      // ⭐ تنظیمات جدید نرخ ارز
      'rate_default_currency',
      'rate_api_provider',
      'rate_api_url',
      'rate_api_key',
      'rate_update_interval',
      'rate_auto_update_enabled'
    ];

    const operations = [];

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        const value = normalizeText(body[key]);
        operations.push(
          context.env.DB.prepare(`
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key) DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `).bind(key, value)
        );
      }
    }

    if (operations.length) {
      await context.env.DB.batch(operations);
    }

    // دریافت تنظیمات به‌روز شده
    const result = await context.env.DB.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'invoice_%'
         OR setting_key IN (
           'cashback_percent', 
           'cashback_statuses', 
           'allow_public_registration',
           'rate_default_currency',
           'rate_api_provider',
           'rate_api_url',
           'rate_api_key',
           'rate_update_interval',
           'rate_auto_update_enabled'
         )
    `).all();

    const rows = Array.isArray(result?.results) ? result.results : [];
    const settings = {};

    for (const row of rows) {
      settings[String(row.setting_key || "").trim()] = String(row.setting_value || "").trim();
    }

    return json({
      success: true,
      message: "settings_saved",
      settings
    });
  } catch (error) {
    return json({
      success: false,
      error: String(error?.message || error)
    }, 500);
  }
}