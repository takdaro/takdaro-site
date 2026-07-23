function json(data, status = 200) {
  return Response.json(data, { status });
}

function getHeader(request, name) {
  return (
    request.headers.get(name) ||
    request.headers.get(name.toLowerCase()) ||
    request.headers.get(name.toUpperCase()) ||
    null
  );
}

function getCookie(cookieString, key) {
  if (!cookieString) return null;

  const cookies = String(cookieString).split("; ");
  const target = cookies.find((item) => item.startsWith(`${key}=`));

  return target ? target.slice(key.length + 1) : null;
}

async function ensureAdminLogsTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      description TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function getCurrentUser(context) {
  const cookieString =
    getHeader(context.request, "Cookie") ||
    getHeader(context.request, "cookie") ||
    "";

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
        COALESCE(users.wallet_balance, 0) AS wallet_balance,
        users.created_at,
        users.updated_at
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
      LIMIT 1
    `)
    .bind(sessionId)
    .first();
}

export async function requireAdmin(context) {
  const user = await getCurrentUser(context);

  if (!user) {
    return {
      ok: false,
      user: null,
      response: json({ success: false, error: "unauthorized" }, 401)
    };
  }

  const role = String(user.role || "").toLowerCase();

  if (!["admin", "super_admin"].includes(role)) {
    return {
      ok: false,
      user,
      response: json({ success: false, error: "forbidden" }, 403)
    };
  }

  return { ok: true, user };
}

export async function logAdminAction(context, payload = {}) {
  try {
    await ensureAdminLogsTable(context.env.DB);

    const forwardedFor =
      getHeader(context.request, "CF-Connecting-IP") ||
      getHeader(context.request, "X-Forwarded-For") ||
      "";

    const ip = String(forwardedFor).split(",")[0].trim();

    await context.env.DB
      .prepare(`
        INSERT INTO admin_activity_logs (
          admin_user_id,
          action,
          target_type,
          target_id,
          description,
          ip_address
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        Number(payload.admin_user_id || 0) || null,
        String(payload.action || ""),
        String(payload.target_type || ""),
        String(payload.target_id || ""),
        String(payload.description || ""),
        ip
      )
      .run();
  } catch (_) {}
}