// ============================================
// mobile-auth.js
// احراز هویت Session اپ مدیریت
// ============================================

const MOBILE_TOKEN_PREFIX = "Bearer ";

// ============================================
// دریافت Bearer Token
// ============================================

function getBearerToken(request) {
  const authorization =
    request?.headers?.get("Authorization") || "";

  if (!authorization.startsWith(MOBILE_TOKEN_PREFIX)) {
    return null;
  }

  const token =
    authorization
      .slice(MOBILE_TOKEN_PREFIX.length)
      .trim();

  return token || null;
}

// ============================================
// Hash کردن Token
// ============================================

async function hashMobileToken(token) {
  const buffer =
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );

  return Array.from(
    new Uint8Array(buffer)
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

// ============================================
// دریافت کاربر از Session موبایل
// ============================================

export async function getMobileUser(context) {
  const token =
    getBearerToken(context?.request);

  if (!token) {
    return {
      ok: false,
      user: null,
      session: null,
      reason: "missing_token"
    };
  }

  const tokenHash =
    await hashMobileToken(token);

  const session =
    await context.env.DB
      .prepare(`
        SELECT
          s.id,
          s.user_id,
          s.created_at,
          s.expires_at,
          s.last_used_at,
          s.revoked_at,
          s.device_name,
          s.device_id,
          u.id AS user_id_value,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.wallet_balance,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at
        FROM admin_mobile_sessions s
        INNER JOIN users u
          ON u.id = s.user_id
        WHERE s.token_hash = ?
        LIMIT 1
      `)
      .bind(tokenHash)
      .first();

  if (!session) {
    return {
      ok: false,
      user: null,
      session: null,
      reason: "invalid_token"
    };
  }

  // ==========================================
  // Session لغوشده
  // ==========================================

  if (session.revoked_at) {
    return {
      ok: false,
      user: null,
      session: null,
      reason: "revoked_token"
    };
  }

  // ==========================================
  // Session منقضی شده
  // ==========================================

  const expiresAt =
    new Date(
      String(session.expires_at)
    ).getTime();

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return {
      ok: false,
      user: null,
      session: null,
      reason: "expired_token"
    };
  }

  // ==========================================
  // فقط Admin / Super Admin
  // ==========================================

  const role =
    String(
      session.role || ""
    )
      .trim()
      .toLowerCase();

  if (
    role !== "admin" &&
    role !== "super_admin"
  ) {
    return {
      ok: false,
      user: null,
      session: null,
      reason: "forbidden"
    };
  }

  // ==========================================
  // ثبت آخرین استفاده
  // ==========================================

  await context.env.DB
    .prepare(`
      UPDATE admin_mobile_sessions
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(session.id)
    .run();

  // ==========================================
  // خروجی تمیز
  // ==========================================

  return {
    ok: true,

    user: {
      id:
        session.user_id_value,

      full_name:
        session.full_name,

      email:
        session.email,

      phone:
        session.phone,

      role:
        session.role,

      wallet_balance:
        session.wallet_balance,

      created_at:
        session.user_created_at,

      updated_at:
        session.user_updated_at
    },

    session: {
      id:
        session.id,

      created_at:
        session.created_at,

      expires_at:
        session.expires_at,

      last_used_at:
        session.last_used_at,

      device_name:
        session.device_name,

      device_id:
        session.device_id
    },

    reason: null
  };
}

// ============================================
// پاسخ استاندارد Unauthorized
// ============================================

export function mobileUnauthorized(reason) {
  let error =
    "احراز هویت انجام نشد.";

  if (reason === "missing_token") {
    error =
      "توکن ورود ارسال نشده است.";
  } else if (
    reason === "invalid_token"
  ) {
    error =
      "توکن ورود نامعتبر است.";
  } else if (
    reason === "expired_token"
  ) {
    error =
      "نشست ورود منقضی شده است.";
  } else if (
    reason === "revoked_token"
  ) {
    error =
      "نشست ورود لغو شده است.";
  } else if (
    reason === "forbidden"
  ) {
    error =
      "این حساب دسترسی مدیریت ندارد.";
  }

  return Response.json(
    {
      success: false,
      error,
      reason
    },
    {
      status:
        reason === "forbidden"
          ? 403
          : 401
    }
  );
}