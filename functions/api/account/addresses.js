function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function normalizePhone(value) {
  if (!value) return "";
  return String(value).trim().replace(/[^\d+]/g, "");
}

async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .bind(sessionId)
    .first();

  return session?.user_id ?? null;
}

export async function onRequestGet(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const addresses = await context.env.DB
      .prepare(`
        SELECT
          id,
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
        WHERE user_id = ?
        ORDER BY is_default DESC, created_at DESC
      `)
      .bind(userId)
      .all();

    return Response.json({
      success: true,
      addresses: addresses.results || []
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await context.request.json();

    const type = String(body.type || "").trim();
    const full_name = String(body.full_name || "").trim();
    const address_line = String(body.address_line || "").trim();
    const postal_code = String(body.postal_code || "").trim();
    const phone = normalizePhone(body.phone || "");
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim();
    const is_default = body.is_default ? 1 : 0;

    if (!["billing", "shipping"].includes(type)) {
      return Response.json({ success: false, error: "invalid address type" }, { status: 400 });
    }

    if (!full_name || !address_line) {
      return Response.json({ success: false, error: "full_name and address_line required" }, { status: 400 });
    }

    if (is_default) {
      await context.env.DB
        .prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ? AND type = ?")
        .bind(userId, type)
        .run();
    }

    const result = await context.env.DB
      .prepare(`
        INSERT INTO addresses (
          user_id, type, full_name, address_line, postal_code, phone, city, state, is_default, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)
      .bind(
        userId,
        type,
        full_name,
        address_line,
        postal_code || null,
        phone || null,
        city || null,
        state || null,
        is_default
      )
      .run();

    const address = await context.env.DB
      .prepare(`
        SELECT
          id,
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
      `)
      .bind(result.meta?.last_row_id, userId)
      .first();

    return Response.json({
      success: true,
      address
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}