import { hashPassword } from "../../lib/password";

function normalizePhone(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}

async function isPublicRegistrationEnabled(env) {
  try {
    const result = await env.DB
      .prepare(`SELECT setting_value FROM app_settings WHERE setting_key = 'allow_public_registration'`)
      .first();

    if (!result) return true;
    return String(result.setting_value || 'true').toLowerCase() === 'true';
  } catch (_) {
    return true;
  }
}

export async function onRequestPost(context) {
  try {
    // بررسی وضعیت ثبت‌نام عمومی
    const publicRegistrationEnabled = await isPublicRegistrationEnabled(context.env);

    if (!publicRegistrationEnabled) {
      return Response.json(
        { 
          success: false, 
          error: "ثبت‌نام کاربر توسط مدیریت سایت انجام می‌شود. لطفاً با پشتیبانی با شماره 09214147070 تماس حاصل فرمایید." 
        },
        { status: 403 }
      );
    }

    const body = await context.request.json();

    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = normalizePhone(body.phone || "");
    const password = String(body.password || "");

    if (!full_name || !email || !phone || !password) {
      return Response.json(
        { success: false, error: "full_name, email, phone, password required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { success: false, error: "password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const weakPasswords = ["123456", "12345678", "password", "qwerty", "111111"];
    if (weakPasswords.includes(password.toLowerCase())) {
      return Response.json(
        { success: false, error: "please choose a stronger password" },
        { status: 400 }
      );
    }

    const existingEmail = await context.env.DB
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existingEmail) {
      return Response.json(
        { success: false, error: "email already exists" },
        { status: 409 }
      );
    }

    const existingPhone = await context.env.DB
      .prepare("SELECT id FROM users WHERE phone = ?")
      .bind(phone)
      .first();

    if (existingPhone) {
      return Response.json(
        { success: false, error: "phone already exists" },
        { status: 409 }
      );
    }

    // ✅ استفاده از hashPassword استاندارد (PBKDF2)
    const password_hash = await hashPassword(password);

    const result = await context.env.DB
      .prepare(
        "INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)"
      )
      .bind(full_name, email, phone, password_hash)
      .run();

    return Response.json(
      {
        success: true,
        inserted: result.success === true,
        id: result.meta?.last_row_id ?? null
      },
      { status: 201 }
    );
  } catch (error) {
    const message = String(error?.message || error);

    if (message.toLowerCase().includes("unique")) {
      return Response.json(
        { success: false, error: "email or phone already exists" },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}