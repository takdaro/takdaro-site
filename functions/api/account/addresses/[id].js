function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).trim().replace(/\s+/g, "");
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

function normalizeAddressInput(body = {}) {
  return {
    type: String(body.type || "shipping").trim().toLowerCase(),
    full_name: String(body.full_name ?? body.fullname ?? "").trim(),
    address_line: String(body.address_line ?? body.addressline ?? "").trim(),
    postal_code: String(body.postal_code ?? body.postalcode ?? "").trim(),
    phone: normalizePhone(body.phone ?? ""),
    city: String(body.city ?? "").trim(),
    state: String(body.state ?? "").trim(),
    is_default:
      Number(body.is_default ?? body.isdefault ?? 0) === 1 ? 1 : 0
  };
}

function validateAddressInput(data) {
  if (!["shipping", "billing"].includes(data.type)) {
    return "نوع آدرس نامعتبر است.";
  }
  if (!data.full_name) return "نام تحویل‌گیرنده الزامی است.";
  if (!data.address_line) return "نشانی کامل الزامی است.";
  if (!data.postal_code) return "کد پستی الزامی است.";
  if (!data.phone) return "شماره تماس الزامی است.";
  if (!data.city) return "شهر الزامی است.";
  if (!data.state) return "استان الزامی است.";
  return null;
}

async function getOwnedAddress(env, userId, addressId) {
  return env.DB.prepare(`
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
  `).bind(addressId, userId).first();
}

export async function onRequestPut(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const addressId = Number(context.params.id);
    if (!addressId) {
      return json({ success: false, error: "شناسه آدرس نامعتبر است." }, 400);
    }

    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json({ success: false, error: "آدرس پیدا نشد." }, 404);
    }

    const body = await context.request.json();
    const data = normalizeAddressInput(body);
    const validationError = validateAddressInput(data);

    if (validationError) {
      return json({ success: false, error: validationError }, 400);
    }

    if (data.is_default === 1) {
      await context.env.DB.prepare(`
        UPDATE addresses
        SET is_default = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).bind(user.id).run();
    }

    await context.env.DB.prepare(`
      UPDATE addresses
      SET
        type = ?,
        full_name = ?,
        address_line = ?,
        postal_code = ?,
        phone = ?,
        city = ?,
        state = ?,
        is_default = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      data.type,
      data.full_name,
      data.address_line,
      data.postal_code,
      data.phone,
      data.city,
      data.state,
      data.is_default,
      addressId,
      user.id
    ).run();

    const address = await getOwnedAddress(context.env, user.id, addressId);

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

export async function onRequestDelete(context) {
  try {
    const user = await getCurrentUser(context.request, context.env);
    if (!user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const addressId = Number(context.params.id);
    if (!addressId) {
      return json({ success: false, error: "شناسه آدرس نامعتبر است." }, 400);
    }

    const existing = await getOwnedAddress(context.env, user.id, addressId);
    if (!existing) {
      return json({ success: false, error: "آدرس پیدا نشد." }, 404);
    }

    await context.env.DB.prepare(`
      DELETE FROM addresses
      WHERE id = ? AND user_id = ?
    `).bind(addressId, user.id).run();

    if (Number(existing.is_default) === 1) {
      const fallback = await context.env.DB.prepare(`
        SELECT id
        FROM addresses
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).bind(user.id).first();

      if (fallback?.id) {
        await context.env.DB.prepare(`
          UPDATE addresses
          SET is_default = 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).bind(fallback.id, user.id).run();
      }
    }

    return json({
      success: true
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}