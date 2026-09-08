import { getMobileUser } from "./mobile-auth";

// ============================================
// توابع مدیریت ادمین و احراز هویت
// ============================================

/**
 * دریافت کوکی از هدر درخواست
 */
function getCookie(cookieString, key) {
  if (!cookieString) return null;

  const cookies = cookieString.split("; ");
  const target = cookies.find(
    (item) => item.startsWith(key + "=")
  );

  return target
    ? target.slice(key.length + 1)
    : null;
}

async function getCurrentUserFromMobileToken(context) {
  try {
    const result = await getMobileUser(context);
    return result.ok ? result.user : null;
  } catch (error) {
    console.error("getCurrentUserFromMobileToken error:", error);
    return null;
  }
}

/**
 * دریافت کاربر فعلی از سشن
 *
 * اول Cookie سشن وب بررسی می‌شود.
 * اگر وجود نداشت، Bearer Token اپ موبایل بررسی می‌شود.
 */
export async function getCurrentUser(context) {
  const cookieString =
    context.request.headers.get("cookie") || "";

  const sessionId = getCookie(
    cookieString,
    "session_id"
  );

  if (sessionId) {
    const user =
      await context.env.DB
        .prepare(`
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            wallet_balance
          FROM users
          WHERE id = (
            SELECT user_id
            FROM sessions
            WHERE id = ?
            LIMIT 1
          )
          LIMIT 1
        `)
        .bind(sessionId)
        .first();

    if (user) {
      return user;
    }
  }

  return await getCurrentUserFromMobileToken(
    context
  );
}

/**
 * بررسی ادمین بودن کاربر
 */
export function isAdmin(user) {
  const role = String(
    user?.role || ""
  ).toLowerCase();

  return (
    role === "admin" ||
    role === "super_admin"
  );
}

/**
 * نیاز به احراز هویت ادمین - برای APIها
 *
 * این تابع هم Session وب و هم
 * Mobile Session Token اپ مدیریت را قبول می‌کند.
 *
 * @param {Object} context - Context درخواست
 * @returns {Promise<Object>} -
 * { ok: boolean, user: Object|null, response: Response|null }
 */
export async function requireAdmin(context) {
  const user =
    await getCurrentUser(context);

  if (!user) {
    return {
      ok: false,
      user: null,
      response: Response.json(
        {
          success: false,
          error: "unauthorized"
        },
        {
          status: 401
        }
      )
    };
  }

  if (!isAdmin(user)) {
    return {
      ok: false,
      user: null,
      response: Response.json(
        {
          success: false,
          error: "forbidden"
        },
        {
          status: 403
        }
      )
    };
  }

  return {
    ok: true,
    user: user,
    response: null
  };
}

/**
 * لاگ عملیات ادمین
 * @param {Object} context - Context درخواست
 * @param {Object} data - اطلاعات لاگ
 */
export async function logAdminAction(context, data) {
  const {
    admin_user_id,
    action,
    target_type,
    target_id,
    description,
    ip_address,
    user_agent
  } = data;

  try {
    const db = context.env.DB;

    const result = await db
      .prepare(`
        INSERT INTO admin_logs (
          admin_user_id,
          action,
          target_type,
          target_id,
          description,
          ip_address,
          user_agent,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(
        admin_user_id || null,
        action || 'unknown',
        target_type || null,
        target_id || null,
        description || null,
        ip_address || null,
        user_agent || null
      )
      .run();

    return {
      success: true,
      id: result.meta?.last_row_id || null
    };
  } catch (error) {
    console.error('❌ logAdminAction error:', error);
    return {
      success: false,
      error: String(error?.message || error)
    };
  }
}

/**
 * دریافت تاریخچه لاگ‌های ادمین
 */
export async function getAdminLogs(env, options = {}) {
  const {
    admin_user_id,
    action,
    limit = 50,
    offset = 0
  } = options;

  const db = env.DB;

  let query = `
    SELECT 
      id,
      admin_user_id,
      action,
      target_type,
      target_id,
      description,
      ip_address,
      user_agent,
      created_at
    FROM admin_logs
    WHERE 1=1
  `;

  const params = [];

  if (admin_user_id) {
    query += ` AND admin_user_id = ?`;
    params.push(admin_user_id);
  }

  if (action) {
    query += ` AND action = ?`;
    params.push(action);
  }

  query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result =
    await db
      .prepare(query)
      .bind(...params)
      .all();

  let countQuery = `
    SELECT COUNT(*) as total
    FROM admin_logs
    WHERE 1=1
  `;

  const countParams = [];

  if (admin_user_id) {
    countQuery += ` AND admin_user_id = ?`;
    countParams.push(admin_user_id);
  }

  if (action) {
    countQuery += ` AND action = ?`;
    countParams.push(action);
  }

  const countResult =
    await db
      .prepare(countQuery)
      .bind(...countParams)
      .first();

  return {
    logs: Array.isArray(result?.results)
      ? result.results
      : [],
    total: countResult?.total || 0,
    limit: limit,
    offset: offset
  };
}
