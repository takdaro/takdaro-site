import { hashPassword, verifyPassword } from "../../lib/password";

function normalizePhone(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}

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
    const body = await context.request.json();

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
            "full_name, email, phone, password required"
        },
        {
          status: 400
        }
      );
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
    if (password.length < 6) {
      return Response.json(
        {
          success: false,
          error:
            "password must be at least 6 characters"
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
            "please choose a stronger password"
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
          "SELECT id FROM users WHERE email = ?"
        )
        .bind(email)
        .first();

    if (existingEmail) {
      return Response.json(
        {
          success: false,
          error: "email already exists"
        },
        {
          status: 409
        }
      );
    }

    // ============================================
    // بررسی تکراری نبودن شماره تلفن
    // ============================================
    const existingPhone =
      await context.env.DB
        .prepare(
          "SELECT id FROM users WHERE phone = ?"
        )
        .bind(phone)
        .first();

    if (existingPhone) {
      return Response.json(
        {
          success: false,
          error: "phone already exists"
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
          VALUES (?, ?, ?, ?)
        `)
        .bind(
          full_name,
          email,
          phone,
          password_hash
        )
        .run();

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
            "email or phone already exists"
        },
        {
          status: 409
        }
      );
    }

    return Response.json(
      {
        success: false,
        error: message
      },
      {
        status: 500
      }
    );
  }
}