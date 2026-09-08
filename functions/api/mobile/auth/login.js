// ============================================
// mobile/auth/login.js
// ورود امن اپ مدیریت Android
// ============================================

import { verifyPassword } from "../../../lib/password";

// ============================================
// تنظیمات Session موبایل
// ============================================

const MOBILE_SESSION_TTL_SECONDS =
  60 * 60 * 24 * 30;

// ============================================
// Normalize Email
// ============================================

function normalizeEmail(email) {
  if (!email) return "";

  return String(email)
    .trim()
    .toLowerCase();
}

// ============================================
// بررسی رمز عبور
// پشتیبانی از PBKDF2 جدید و SHA-256 قدیمی
// ============================================

async function verifyPasswordCompatible(
  password,
  storedHash
) {
  // ------------------------------------------
  // PBKDF2 جدید
  // ------------------------------------------

  if (
    storedHash &&
    storedHash.startsWith("pbkdf2$")
  ) {
    return await verifyPassword(
      password,
      storedHash
    );
  }

  // ------------------------------------------
  // SHA-256 قدیمی
  // ------------------------------------------

  if (
    storedHash &&
    /^[a-f0-9]{64}$/i.test(
      String(storedHash)
    )
  ) {
    const data =
      new TextEncoder().encode(
        password
      );

    const hashBuffer =
      await crypto.subtle.digest(
        "SHA-256",
        data
      );

    const hashed =
      Array.from(
        new Uint8Array(hashBuffer)
      )
        .map((byte) =>
          byte
            .toString(16)
            .padStart(2, "0")
        )
        .join("");

    return (
      hashed.toLowerCase() ===
      String(storedHash).toLowerCase()
    );
  }

  return false;
}

// ============================================
// دریافت تنظیمات کد عبور سایت
// ============================================

async function getAccessCodeSettings(
  env
) {
  const result =
    await env.DB.prepare(`
      SELECT
        setting_key,
        setting_value
      FROM app_settings
      WHERE setting_key IN (
        'site_access_code_enabled',
        'site_access_code_hash'
      )
    `).all();

  const rows =
    Array.isArray(result?.results)
      ? result.results
      : [];

  const settings = {};

  for (const row of rows) {
    settings[
      String(
        row.setting_key || ""
      ).trim()
    ] =
      String(
        row.setting_value || ""
      ).trim();
  }

  return {
    enabled:
      String(
        settings.site_access_code_enabled ||
        "false"
      ).toLowerCase() ===
      "true",

    hash:
      settings.site_access_code_hash ||
      ""
  };
}

// ============================================
// تولید Token امن موبایل
// ============================================

function generateMobileToken() {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(32)
    );

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// ============================================
// Hash کردن Token
// ============================================

async function hashMobileToken(
  token
) {
  const buffer =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );

  return Array.from(
    new Uint8Array(buffer)
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

// ============================================
// تاریخ انقضای Session
// ============================================

function getExpiresAt() {
  return new Date(
    Date.now() +
      MOBILE_SESSION_TTL_SECONDS *
        1000
  ).toISOString();
}

// ============================================
// POST - ورود اپ مدیریت
// ============================================

export async function onRequestPost(
  context
) {
  try {
    const { request, env } =
      context;

    // ========================================
    // دریافت Body
    // ========================================

    const body =
      await request
        .json()
        .catch(() => null);

    const email =
      normalizeEmail(
        body?.email || ""
      );

    const password =
      String(
        body?.password || ""
      );

    const accessCode =
      String(
        body?.access_code || ""
      ).trim();

    const deviceName =
      String(
        body?.device_name || ""
      ).trim();

    const deviceId =
      String(
        body?.device_id || ""
      ).trim();

    // ========================================
    // بررسی ورودی
    // ========================================

    if (!email || !password) {
      return Response.json(
        {
          success: false,
          error:
            "ایمیل و رمز عبور را وارد کنید."
        },
        {
          status: 400
        }
      );
    }

    // ========================================
    // بررسی کد عبور سایت
    // ========================================

    const accessCodeSettings =
      await getAccessCodeSettings(
        env
      );

    if (
      accessCodeSettings.enabled
    ) {
      if (!accessCode) {
        return Response.json(
          {
            success: false,
            error:
              "کد عبور سایت را وارد کنید."
          },
          {
            status: 401
          }
        );
      }

      if (
        !accessCodeSettings.hash
      ) {
        return Response.json(
          {
            success: false,
            error:
              "کد عبور سایت تعریف نشده است."
          },
          {
            status: 503
          }
        );
      }

      const isAccessCodeValid =
        await verifyPasswordCompatible(
          accessCode,
          accessCodeSettings.hash
        );

      if (!isAccessCodeValid) {
        return Response.json(
          {
            success: false,
            error:
              "کد عبور سایت صحیح نیست."
          },
          {
            status: 401
          }
        );
      }
    }

    // ========================================
    // دریافت کاربر
    // ========================================

    const user =
      await env.DB
        .prepare(`
          SELECT
            id,
            full_name,
            phone,
            email,
            role,
            wallet_balance,
            password_hash,
            created_at,
            updated_at
          FROM users
          WHERE email = ?
          LIMIT 1
        `)
        .bind(email)
        .first();

    // ========================================
    // کاربر وجود ندارد
    // ========================================

    if (!user) {
      return Response.json(
        {
          success: false,
          error:
            "ایمیل یا رمز عبور صحیح نیست."
        },
        {
          status: 401
        }
      );
    }

    // ========================================
    // فقط Admin / Super Admin
    // ========================================

    const role =
      String(
        user.role || ""
      )
        .trim()
        .toLowerCase();

    const isAdmin =
      role === "admin" ||
      role === "super_admin";

    if (!isAdmin) {
      return Response.json(
        {
          success: false,
          error:
            "این حساب دسترسی مدیریت ندارد."
        },
        {
          status: 403
        }
      );
    }

    // ========================================
    // بررسی رمز عبور
    // ========================================

    const isPasswordValid =
      await verifyPasswordCompatible(
        password,
        user.password_hash
      );

    if (!isPasswordValid) {
      return Response.json(
        {
          success: false,
          error:
            "ایمیل یا رمز عبور صحیح نیست."
        },
        {
          status: 401
        }
      );
    }

    // ========================================
    // تولید Token موبایل
    // ========================================

    const mobileToken =
      generateMobileToken();

    const tokenHash =
      await hashMobileToken(
        mobileToken
      );

    const expiresAt =
      getExpiresAt();

    const userAgent =
      request.headers.get(
        "user-agent"
      ) || "";

    // ========================================
    // ذخیره Session موبایل
    // ========================================

    const insertResult =
      await env.DB
        .prepare(`
          INSERT INTO admin_mobile_sessions (
            user_id,
            token_hash,
            created_at,
            expires_at,
            last_used_at,
            revoked_at,
            device_name,
            device_id,
            user_agent
          )
          VALUES (
            ?,
            ?,
            CURRENT_TIMESTAMP,
            ?,
            CURRENT_TIMESTAMP,
            NULL,
            ?,
            ?,
            ?
          )
        `)
        .bind(
          Number(user.id),
          tokenHash,
          expiresAt,
          deviceName || null,
          deviceId || null,
          userAgent || null
        )
        .run();

    // ========================================
    // پاسخ موفق
    // ========================================

    return Response.json(
      {
        success: true,

        token:
          mobileToken,

        expires_at:
          expiresAt,

        user: {
          id:
            user.id,

          full_name:
            user.full_name,

          phone:
            user.phone,

          email:
            user.email,

          role:
            user.role,

          wallet_balance:
            user.wallet_balance,

          created_at:
            user.created_at,

          updated_at:
            user.updated_at
        },

        session: {
          id:
            insertResult?.meta
              ?.last_row_id ||
            null,

          expires_at:
            expiresAt
        }
      },
      {
        status: 200
      }
    );

  } catch (error) {
    console.error(
      "Mobile admin login error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "خطا در ورود به حساب مدیریت."
      },
      {
        status: 500
      }
    );
  }
}