function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

export async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  return await context.env.DB
    .prepare(`
      SELECT
        users.id,
        users.full_name,
        users.email,
        users.phone,
        users.role,
        users.wallet_balance,
        users.created_at,
        users.updated_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
    `)
    .bind(sessionId)
    .first();
}

export async function requireAdmin(context) {
  const user = await getCurrentUser(context);

  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      )
    };
  }

  if (!["admin", "super_admin"].includes(String(user.role || "").toLowerCase())) {
    return {
      ok: false,
      response: Response.json(
        { success: false, error: "forbidden" },
        { status: 403 }
      )
    };
  }

  return { ok: true, user };
}

export async function logAdminAction(context, payload = {}) {
  try {
    const ip =
      context.request.headers.get("CF-Connecting-IP") ||
      context.request.headers.get("X-Forwarded-For") ||
      "";

    await context.env.DB
      .prepare(`
        INSERT INTO admin_activity_logs
        (admin_user_id, action, target_type, target_id, description, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        payload.admin_user_id,
        String(payload.action || ""),
        String(payload.target_type || ""),
        String(payload.target_id || ""),
        String(payload.description || ""),
        ip
      )
      .run();
  } catch {}
}