import { verifyPassword } from "../../lib/password";

function normalizeEmail(email) {
  if (!email) return "";

  return String(email)
    .trim()
    .toLowerCase();
}

// ============================================
// بررسی رمز عبور
// پشتیبانی از PBKDF2 و SHA-256 قدیمی
// ============================================

async function verifyPasswordCompatible(
  password,
  storedHash
) {
  // ==========================================
  // PBKDF2 جدید
  // ==========================================

  if (
    storedHash &&
    storedHash.startsWith("pbkdf2$")
  ) {
    return await verifyPassword(
      password,
      storedHash
    );
  }

  // ==========================================
  // SHA-256 قدیمی
  // ==========================================

  if (
    storedHash &&
    storedHash.match(/^[a-f0-9]{64}$/i)
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
      [...new Uint8Array(hashBuffer)]
        .map(function (b) {
          return b
            .toString(16)
            .padStart(2, "0");
        })
        .join("");

    return (
      hashed.toLowerCase() ===
      storedHash.toLowerCase()
    );
  }

  return false;
}

// ============================================
// دریافت تنظیمات کد عبور سایت
// ============================================

async function getAccessCodeSettings(env) {
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
      String(row.setting_key || "").trim()
    ] =
      String(row.setting_value || "").trim();
  }

  return {
    enabled:
      String(
        settings.site_access_code_enabled ||
        "false"
      ).toLowerCase() === "true",

    hash:
      settings.site_access_code_hash ||
      ""
  };
}

// ============================================
// POST - ورود کاربر
// ============================================

export async function onRequestPost(context) {
  try {
    const body =
      await context.request.json();

    const email =
      normalizeEmail(
        body.email || ""
      );

    const password =
      String(
        body.password || ""
      );

    const accessCode =
      String(
        body.access_code || ""
      ).trim();

    // ==========================================
    // بررسی ایمیل و رمز عبور
    // ==========================================

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

    // ==========================================
    // دریافت تنظیمات کد سایت
    // ==========================================

    const accessCodeSettings =
      await getAccessCodeSettings(
        context.env
      );

    // ==========================================
    // بررسی کد سایت در صورت فعال بودن
    // ==========================================

    if (accessCodeSettings.enabled) {
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

      if (!accessCodeSettings.hash) {
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

      // ========================================
      // بررسی کد با همان سیستم سازگار هش
      // ========================================

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

    // ==========================================
    // دریافت کاربر
    // ==========================================

    const user =
      await context.env.DB
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
        `)
        .bind(email)
        .first();

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

    // ==========================================
    // بررسی رمز عبور کاربر
    // ==========================================

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

    // ==========================================
    // ساخت Session
    // ==========================================

    const sessionId =
      crypto.randomUUID();

    await context.env.DB
      .prepare(`
        INSERT INTO sessions (
          id,
          user_id,
          created_at
        )
        VALUES (
          ?,
          ?,
          CURRENT_TIMESTAMP
        )
      `)
      .bind(
        sessionId,
        user.id
      )
      .run();

    // ==========================================
    // پاسخ موفق
    // ==========================================

    const response =
      Response.json({
        success: true,

        user: {
          id: user.id,
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
        }
      });

    response.headers.set(
      "Set-Cookie",
      `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    );

    return response;

  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(
          error?.message || error
        )
      },
      {
        status: 500
      }
    );
  }
}