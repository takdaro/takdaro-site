function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  if (!target) return null;
  return target.slice(key.length + 1);
}

async function getCurrentUser(context) {
  const cookieString = context.request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");
  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare(`
      SELECT users.id, users.full_name, users.email, users.role
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
      LIMIT 1
    `)
    .bind(sessionId)
    .first();

  return session || null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function requireAdmin(context) {
  const user = await getCurrentUser(context);
  if (!user) {
    return { error: json({ success: false, error: "unauthorized" }, 401) };
  }

  const role = String(user.role || "").trim().toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    return { error: json({ success: false, error: "forbidden" }, 403) };
  }

  return { user };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value, allowed, fallback = "") {
  const v = normalizeText(value).toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) return auth.error;

    const url = new URL(context.request.url);
    const search = normalizeText(url.searchParams.get("search"));
    const status = normalizeStatus(
      url.searchParams.get("status"),
      ["pending", "processing", "shipped", "completed", "cancelled"]
    );
    const paymentStatus = normalizeStatus(
      url.searchParams.get("payment_status"),
      ["pending", "paid", "completed", "failed"]
    );

    let sql = `
      SELECT
        orders.id,
        orders.order_number,
        orders.user_id,
        orders.status,
        orders.payment_status,
        COALESCE(orders.total_amount, 0) AS total_amount,
        orders.created_at,
        users.full_name,
        users.email,
        users.phone
      FROM orders
      LEFT JOIN users ON users.id = orders.user_id
      WHERE 1 = 1
    `;

    const binds = [];

    if (search) {
      sql += `
        AND (
          orders.order_number LIKE ?
          OR users.full_name LIKE ?
          OR users.email LIKE ?
          OR users.phone LIKE ?
        )
      `;
      const q = `%${search}%`;
      binds.push(q, q, q, q);
    }

    if (status) {
      sql += ` AND LOWER(COALESCE(orders.status, 'pending')) = ? `;
      binds.push(status);
    }

    if (paymentStatus) {
      sql += ` AND LOWER(COALESCE(orders.payment_status, 'pending')) = ? `;
      binds.push(paymentStatus);
    }

    sql += ` ORDER BY orders.created_at DESC, orders.id DESC `;

    const result = await context.env.DB.prepare(sql).bind(...binds).all();
    const orders = result?.results || [];

    return json({
      success: true,
      orders
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) return auth.error;

    const body = await context.request.json();
    const orderNumber = normalizeText(body.order_number);
    const status = normalizeStatus(
      body.status,
      ["pending", "processing", "shipped", "completed", "cancelled"],
      "pending"
    );
    const paymentStatus = normalizeStatus(
      body.payment_status,
      ["pending", "paid", "completed", "failed"],
      "pending"
    );

    if (!orderNumber) {
      return json({ success: false, error: "order_number required" }, 400);
    }

    const order = await context.env.DB
      .prepare(`SELECT id FROM orders WHERE order_number = ? LIMIT 1`)
      .bind(orderNumber)
      .first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    await context.env.DB
      .prepare(`
        UPDATE orders
        SET status = ?, payment_status = ?
        WHERE order_number = ?
      `)
      .bind(status, paymentStatus, orderNumber)
      .run();

    return json({ success: true });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) return auth.error;

    const body = await context.request.json();
    const orderNumber = normalizeText(body.order_number);

    if (!orderNumber) {
      return json({ success: false, error: "order_number required" }, 400);
    }

    const order = await context.env.DB
      .prepare(`SELECT id FROM orders WHERE order_number = ? LIMIT 1`)
      .bind(orderNumber)
      .first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    await context.env.DB
      .prepare(`DELETE FROM order_items WHERE order_id = ?`)
      .bind(order.id)
      .run();

    await context.env.DB
      .prepare(`DELETE FROM orders WHERE id = ?`)
      .bind(order.id)
      .run();

    return json({ success: true });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}