function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB.prepare(`
    SELECT id, full_name, email, phone, role
    FROM users
    WHERE id = (SELECT user_id FROM sessions WHERE id = ? LIMIT 1)
    LIMIT 1
  `).bind(sessionId).first();
}

function isAdmin(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin";
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

    // برای دسترسی عمومی (همه کاربران) - چون فاکتور نیاز به تنظیمات دارد
    // اما اگر کاربر لاگین نکرده باشد، تنظیمات پیش‌فرض برگردانده می‌شود

    const result = await context.env.DB.prepare(`
      SELECT setting_key, setting_value
      FROM app_settings
      WHERE setting_key LIKE 'invoice_%'
         OR setting_key IN ('cashback_percent', 'cashback_statuses')
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
    const user = await getCurrentUser(context);

    if (!user || !isAdmin(user)) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

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