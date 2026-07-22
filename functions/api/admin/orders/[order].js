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

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context);
    if (auth.error) return auth.error;

    const orderNumber = normalizeText(context.params.order);
    if (!orderNumber) {
      return json({ success: false, error: "order required" }, 400);
    }

    const order = await context.env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          COALESCE(o.total_amount, 0) AS total_amount,
          COALESCE(o.shipping_amount, 0) AS shipping_amount,
          COALESCE(o.discount_amount, 0) AS discount_amount,
          o.payment_status,
          o.created_at,
          o.updated_at,
          o.shipping_address_id,
          o.billing_address_id,
          COALESCE(o.cashback_amount, 0) AS cashback_amount,
          COALESCE(o.cashback_percent, 0) AS cashback_percent,
          COALESCE(o.cashback_status, 'none') AS cashback_status,
          o.cashback_created_txn_id,
          o.cashback_created_at,
          u.id AS user_id,
          u.full_name,
          u.email,
          u.phone
        FROM orders o
        JOIN users u ON u.id = o.user_id
        WHERE o.order_number = ?
        LIMIT 1
      `)
      .bind(orderNumber)
      .first();

    if (!order) {
      return json({ success: false, error: "order not found" }, 404);
    }

    let items = [];
    try {
      const itemsResult = await context.env.DB
        .prepare(`
          SELECT
            id,
            COALESCE(product_name, 'محصول') AS product_name,
            COALESCE(quantity, 0) AS quantity,
            COALESCE(unit_price, 0) AS unit_price,
            COALESCE(total_price, 0) AS total_price,
            created_at
          FROM order_items
          WHERE order_id = ?
          ORDER BY id ASC
        `)
        .bind(order.id)
        .all();

      items = itemsResult?.results || [];
    } catch (_) {
      items = [];
    }

    let shipping_address = null;
    let billing_address = null;
    let cashback_transaction = null;

    if (order.shipping_address_id) {
      try {
        shipping_address = await context.env.DB
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
              is_default
            FROM addresses
            WHERE id = ?
            LIMIT 1
          `)
          .bind(order.shipping_address_id)
          .first();
      } catch (_) {
        shipping_address = null;
      }
    }

    if (order.billing_address_id) {
      try {
        billing_address = await context.env.DB
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
              is_default
            FROM addresses
            WHERE id = ?
            LIMIT 1
          `)
          .bind(order.billing_address_id)
          .first();
      } catch (_) {
        billing_address = null;
      }
    }

    if (order.cashback_created_txn_id) {
      try {
        cashback_transaction = await context.env.DB
          .prepare(`
            SELECT
              id,
              type,
              amount,
              balance_before,
              balance_after,
              status,
              source,
              description,
              created_at
            FROM wallet_transactions
            WHERE id = ?
            LIMIT 1
          `)
          .bind(order.cashback_created_txn_id)
          .first();
      } catch (_) {
        cashback_transaction = null;
      }
    }

    return json({
      success: true,
      order: {
        ...order,
        items,
        shipping_address,
        billing_address,
        cashback_transaction
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}