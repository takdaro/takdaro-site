import { getCurrentUser, requireAdmin } from "../../lib/admin";
import { hashPassword } from "../../lib/password";

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
           'site_access_code_enabled',
           'site_access_code_hash',
           'rate_default_currency',
           'rate_api_provider',
           'rate_api_url',
           'rate_api_key',
           'rate_update_interval',
           'rate_auto_update_enabled'
         )
    `).all();

    const rows = Array.isArray(result?.results)
      ? result.results
      : [];

    const settings = {};

    for (const row of rows) {
      settings[
        String(row.setting_key || "").trim()
      ] = String(row.setting_value || "").trim();
    }

    // ============================================
    // تنظیمات پیش‌فرض
    // ============================================

    const defaults = {
      invoice_logo: '',
      invoice_thankyou_text:
        'سپاس‌گزاریم که از تک تجارت خرید کردید. سفارش شما با موفقیت ثبت شد.',
      invoice_bank_account:
        'بانک ملی - شماره حساب: ۱۲۳۴۵۶۷۸۹۰',
      invoice_card_number:
        '۶۰۳۷-۷۹۹۱-۵۰۵۴-۴۳۴۲',
      invoice_sheba_number:
        'IR۴۵۰۱۷۰۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰',
      invoice_payment_deadline:
        '۲۴ ساعت',
      invoice_payment_description:
        'لطفاً مبلغ فاکتور را به شماره کارت درج شده واریز و تصویر رسید را به شماره واتساپ پشتیبانی ارسال کنید.',
      invoice_whatsapp_number:
        '۰۹۱۲۳۴۵۶۷۸۹',
      invoice_company_name:
        'تک تجارت',
      invoice_company_phone:
        '۰۲۱-۱۲۳۴۵۶۷۸',
      invoice_company_address:
        'تهران، خیابان ولیعصر، پلاک ۱۲۳',

      // ثبت‌نام عمومی
      allow_public_registration: 'true',

      // کد عبور سایت
      site_access_code_enabled: 'false',

      // تنظیمات نرخ ارز
      rate_default_currency: 'USD',
      rate_api_provider: 'tgju',
      rate_api_url:
        'https://api.tgju.org/v1/market/price/price_dollar_rl',
      rate_api_key: '',
      rate_update_interval: '3600',
      rate_auto_update_enabled: 'false'
    };

    for (const [key, defaultValue] of Object.entries(defaults)) {
      if (
        settings[key] === undefined ||
        settings[key] === ''
      ) {
        settings[key] = defaultValue;
      }
    }

    // ============================================
    // امنیت:
    // هش کد عبور هرگز به مرورگر ارسال نمی‌شود
    // ============================================

    delete settings.site_access_code_hash;

    return json({
      success: true,
      settings
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: String(
          error?.message || error
        )
      },
      500
    );
  }
}

// ============================================
// POST - ذخیره تنظیمات
// فقط ادمین
// ============================================

export async function onRequestPost(context) {
  try {
    const adminCheck = await requireAdmin(context);

    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const body =
      await context.request.json()
        .catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return json(
        {
          success: false,
          error: "invalid_payload"
        },
        400
      );
    }

    // ============================================
    // کلیدهای مجاز
    // ============================================

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

      // وضعیت کد عبور سایت
      'site_access_code_enabled',

      // نرخ ارز
      'rate_default_currency',
      'rate_api_provider',
      'rate_api_url',
      'rate_api_key',
      'rate_update_interval',
      'rate_auto_update_enabled'
    ];

    const operations = [];

    // ============================================
    // ذخیره تنظیمات معمولی
    // ============================================

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        const value = normalizeText(body[key]);

        operations.push(
          context.env.DB.prepare(`
            INSERT INTO app_settings (
              setting_key,
              setting_value,
              updated_at
            )
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(setting_key)
            DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            key,
            value
          )
        );
      }
    }

    // ============================================
    // ذخیره امن کد عبور سایت
    //
    // خود کد عبور ذخیره نمی‌شود.
    // فقط هش PBKDF2 آن ذخیره می‌شود.
    // ============================================

    if (
      body.site_access_code !== undefined
    ) {
      const accessCode =
        String(
          body.site_access_code || ""
        ).trim();

      if (accessCode) {
        if (accessCode.length < 4) {
          return json(
            {
              success: false,
              error:
                "کد عبور سایت باید حداقل 4 کاراکتر باشد."
            },
            400
          );
        }

        const accessCodeHash =
          await hashPassword(accessCode);

        operations.push(
          context.env.DB.prepare(`
            INSERT INTO app_settings (
              setting_key,
              setting_value,
              updated_at
            )
            VALUES (
              'site_access_code_hash',
              ?,
              CURRENT_TIMESTAMP
            )
            ON CONFLICT(setting_key)
            DO UPDATE SET
              setting_value = excluded.setting_value,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            accessCodeHash
          )
        );
      }
    }

    // ============================================
    // جلوگیری از فعال شدن کد عبور بدون تعیین کد
    // ============================================

    if (
      String(
        body.site_access_code_enabled || ""
      ).toLowerCase() === "true"
    ) {
      const newAccessCode =
        String(
          body.site_access_code || ""
        ).trim();

      if (!newAccessCode) {
        const existingCode =
          await context.env.DB.prepare(`
            SELECT setting_value
            FROM app_settings
            WHERE setting_key = 'site_access_code_hash'
          `).first();

        if (
          !existingCode ||
          !existingCode.setting_value
        ) {
          return json(
            {
              success: false,
              error:
                "ابتدا کد عبور سایت را وارد و ذخیره کنید."
            },
            400
          );
        }
      }
    }

    // ============================================
    // اجرای ذخیره‌سازی
    // ============================================

    if (operations.length) {
      await context.env.DB.batch(
        operations
      );
    }

    // ============================================
    // دریافت تنظیمات جدید
    // ============================================

    const result =
      await context.env.DB.prepare(`
        SELECT setting_key, setting_value
        FROM app_settings
        WHERE setting_key LIKE 'invoice_%'
           OR setting_key IN (
             'cashback_percent',
             'cashback_statuses',
             'allow_public_registration',
             'site_access_code_enabled',
             'site_access_code_hash',
             'rate_default_currency',
             'rate_api_provider',
             'rate_api_url',
             'rate_api_key',
             'rate_update_interval',
             'rate_auto_update_enabled'
           )
      `).all();

    const rows =
      Array.isArray(result?.results)
        ? result.results
        : [];

    const settings = {};

    for (const row of rows) {
      settings[
        String(row.setting_key || "").trim()
      ] = String(row.setting_value || "").trim();
    }

    // هش نباید به فرانت‌اند برگردد
    delete settings.site_access_code_hash;

    return json({
      success: true,
      message: "settings_saved",
      settings
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: String(
          error?.message || error
        )
      },
      500
    );
  }
}