import { hashPassword, verifyPassword } from "../../lib/password";

function normalizePhone(value) {
  if (!value) return "";
  let phone = String(value).trim().replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  if (!/^[+\d\s()-]+$/.test(phone)) return "";
  phone = phone.replace(/[\s()-]/g, '');
  if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  else if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  else if (phone.startsWith('98')) phone = '0' + phone.slice(2);
  else if (/^9\d{9}$/.test(phone)) phone = '0' + phone;
  return /^09\d{9}$/.test(phone) ? phone : "";
}

const phoneSql = "replace(replace(replace(replace(trim(phone), ' ', ''), '-', ''), '(', ''), ')', '')";

// ============================================
// دریافت تنظیمات ثبت‌نام و کد عبور سایت
// ============================================
async function getAuthSettings(env) {
  const result = await env.DB.prepare(`
    SELECT setting_key, setting_value
    FROM app_settings
    WHERE setting_key IN (
      'allow_public_registration',
      'site_access_code_enabled',
      'site_access_code_hash'
    )
  `).all();

  const rows = Array.isArray(result?.results)
    ? result.results
    : [];

  const settings = {};

  for (const row of rows) {
    settings[String(row.setting_key || "").trim()] =
      String(row.setting_value || "").trim();
  }

  return {
    publicRegistrationEnabled:
      String(
        settings.allow_public_registration ?? "true"
      ).toLowerCase() === "true",

    accessCodeEnabled:
      String(
        settings.site_access_code_enabled ?? "false"
      ).toLowerCase() === "true",

    accessCodeHash:
      settings.site_access_code_hash || ""
  };
}

// ============================================
// POST - ثبت‌نام کاربر
// ============================================
export async function onRequestPost(context) {
  try {
    let body;
    try { body = await context.request.json(); } catch {
      return Response.json({ success: false, error: 'اطلاعات فرم معتبر نیست.' }, { status: 400 });
    }
    if (!body || Array.isArray(body) || typeof body !== 'object' || ['full_name', 'email', 'phone', 'password', 'access_code'].some(key => body[key] !== undefined && typeof body[key] !== 'string')) {
      return Response.json({ success: false, error: 'اطلاعات فرم معتبر نیست.' }, { status: 400 });
    }

    // ============================================
    // دریافت تنظیمات سایت
    // ============================================
    const authSettings =
      await getAuthSettings(context.env);

    // ============================================
    // بررسی فعال بودن ثبت‌نام عمومی
    // ============================================
    if (!authSettings.publicRegistrationEnabled) {
      return Response.json(
        {
          success: false,
          error:
            "ثبت‌نام کاربر توسط مدیریت سایت انجام می‌شود. لطفاً با پشتیبانی با شماره 09214147070 تماس حاصل فرمایید."
        },
        {
          status: 403
        }
      );
    }

    // ============================================
    // دریافت اطلاعات فرم
    // ============================================
    const full_name =
      String(body.full_name || "").trim();

    const email =
      String(body.email || "")
        .trim()
        .toLowerCase();

    const phone =
      normalizePhone(body.phone || "");

    const password =
      String(body.password || "");

    const accessCode =
      String(body.access_code || "").trim();

    // ============================================
    // بررسی اطلاعات ضروری
    // ============================================
    if (
      !full_name ||
      !email ||
      !phone ||
      !password
    ) {
      return Response.json(
        {
          success: false,
          error:
            "نام، ایمیل، شماره موبایل معتبر و رمز عبور را وارد کنید."
        },
        {
          status: 400
        }
      );
    }

    if (full_name.length < 2 || full_name.length > 150 || /[\x00-\x1f]/.test(full_name)) {
      return Response.json({ success: false, error: 'نام و نام خانوادگی باید بین ۲ تا ۱۵۰ نویسه باشد.' }, { status: 400 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\x00-\x1f]/.test(email)) {
      return Response.json({ success: false, error: 'ایمیل معتبر وارد کنید.' }, { status: 400 });
    }

    // ============================================
    // بررسی کد عبور سایت
    // ============================================
    if (authSettings.accessCodeEnabled) {
      if (!accessCode) {
        return Response.json(
          {
            success: false,
            error:
              "کد عبور سایت را وارد کنید."
          },
          {
            status: 400
          }
        );
      }

      // فعال بودن کد عبور بدون هش
      if (!authSettings.accessCodeHash) {
        return Response.json(
          {
            success: false,
            error:
              "تنظیمات کد عبور سایت کامل نیست. با مدیریت سایت تماس بگیرید."
          },
          {
            status: 503
          }
        );
      }

      // بررسی امن کد عبور
      const isAccessCodeValid =
        await verifyPassword(
          accessCode,
          authSettings.accessCodeHash
        );

      if (!isAccessCodeValid) {
        return Response.json(
          {
            success: false,
            error:
              "کد عبور سایت صحیح نیست."
          },
          {
            status: 403
          }
        );
      }
    }

    // ============================================
    // بررسی رمز عبور کاربر
    // ============================================
    if (password.length < 8 || password.length > 256) {
      return Response.json(
        {
          success: false,
          error:
            "رمز عبور باید بین ۸ تا ۲۵۶ نویسه باشد."
        },
        {
          status: 400
        }
      );
    }

    const weakPasswords = [
      "123456",
      "12345678",
      "password",
      "qwerty",
      "111111"
    ];

    if (
      weakPasswords.includes(
        password.toLowerCase()
      )
    ) {
      return Response.json(
        {
          success: false,
          error:
            "لطفاً رمز عبور قوی‌تری انتخاب کنید."
        },
        {
          status: 400
        }
      );
    }

    // ============================================
    // بررسی تکراری نبودن ایمیل
    // ============================================
    const existingEmail =
      await context.env.DB
        .prepare(
          "SELECT id FROM users WHERE email = ? COLLATE NOCASE"
        )
        .bind(email)
        .first();

    if (existingEmail) {
      return Response.json(
        {
          success: false,
          error: "این ایمیل قبلاً ثبت شده است."
        },
        {
          status: 409
        }
      );
    }

    // ============================================
    // بررسی تکراری نبودن شماره تلفن
    // ============================================
    const phoneVariants = [phone, '+98' + phone.slice(1), '98' + phone.slice(1), '0098' + phone.slice(1), phone.slice(1)];
    const existingPhone =
      await context.env.DB
        .prepare(
          `SELECT id FROM users WHERE ${phoneSql} IN (?, ?, ?, ?, ?)`
        )
        .bind(...phoneVariants)
        .first();

    if (existingPhone) {
      return Response.json(
        {
          success: false,
          error: "این شماره موبایل قبلاً ثبت شده است."
        },
        {
          status: 409
        }
      );
    }

    // ============================================
    // هش کردن رمز عبور کاربر
    // ============================================
    const password_hash =
      await hashPassword(password);

    // ============================================
    // ایجاد کاربر
    // ============================================
    const result =
      await context.env.DB
        .prepare(`
          INSERT INTO users (
            full_name,
            email,
            phone,
            password_hash
          )
          SELECT ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE email = ? COLLATE NOCASE OR ${phoneSql} IN (?, ?, ?, ?, ?)
          )
        `)
        .bind(
          full_name,
          email,
          phone,
          password_hash,
          email,
          ...phoneVariants
        )
        .run();

    if (!result.success) throw new Error('Registration insert failed');
    if (Number(result.meta?.changes) !== 1) {
      return Response.json({ success: false, error: 'این ایمیل یا شماره موبایل قبلاً ثبت شده است.' }, { status: 409 });
    }

    // ============================================
    // پاسخ موفق
    // ============================================
    return Response.json(
      {
        success: true,
        inserted:
          result.success === true,
        id:
          result.meta?.last_row_id ?? null
      },
      {
        status: 201
      }
    );

  } catch (error) {
    const message =
      String(error?.message || error);

    if (
      message.toLowerCase()
        .includes("unique")
    ) {
      return Response.json(
        {
          success: false,
          error:
            "این ایمیل یا شماره موبایل قبلاً ثبت شده است."
        },
        {
          status: 409
        }
      );
    }

    return Response.json(
      {
        success: false,
        error: 'ثبت‌نام انجام نشد؛ لطفاً دوباره تلاش کنید.'
      },
      {
        status: 500
      }
    );
  }
}
