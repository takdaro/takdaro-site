function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

async function getCurrentUser(request, env) {
  const sessionId = getCookie(request.headers.get("cookie"), "session_id");
  if (!sessionId) return null;

  const row = await env.DB.prepare(`
    SELECT users.id, users.email, users.fullname, users.phone
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
    LIMIT 1
  `).bind(sessionId).first();

  return row || null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function onRequestPost(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const addressId = Number(context.params.id);
    if (!addressId) {
      return json({ success: false, error: "شناسه آدرس نامعتبر است." }, 400);
    }

    const existing = await context.env.DB.prepare(`
      SELECT id
      FROM addresses
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(addressId, user.id).first();

    if (!existing) {
      return json({ success: false, error: "آدرس پیدا نشد." }, 404);
    }

    await context.env.DB.prepare(`
      UPDATE addresses
      SET is_default = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(user.id).run();

    await context.env.DB.prepare(`
      UPDATE addresses
      SET is_default = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(addressId, user.id).run();

    const address = await context.env.DB.prepare(`
      SELECT
        id,
        user_id,
        type,
        full_name,
        address_line,
        postal_code,
        phone,
        city,
        state,
        is_default,
        created_at,
        updated_at
      FROM addresses
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `).bind(addressId, user.id).first();

    return json({
      success: true,
      address
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}