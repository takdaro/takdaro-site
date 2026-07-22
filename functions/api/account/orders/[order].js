function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
}

function json(data, status = 200) {
  return Response.json(data, { status });
}

async function getCurrentUserId(context) {
  const cookieString = context.request.headers.get("cookie") || "";
  const sessionId = getCookie(cookieString, "session_id");

  if (!sessionId) return null;

  const session = await context.env.DB
    .prepare(`
      SELECT user_id
      FROM sessions
      WHERE id = ?
      LIMIT 1
    `)
    .bind(sessionId)
    .first();

  return session?.user_id ?? null;
}

export async function onRequestGet(context) {
  try {
    const userId = await getCurrentUserId(context);

    if (!userId) {
      return json({ success: false, error: "unauthorized" }, 401);
    }

    const orderNumber = decodeURIComponent(String(context.params?.order || "")).trim();

    if (!orderNumber) {
      return json({ success: false, error: "order_number_required" }, 400);
    }

    const order = await context.env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.payment_status,
          o.subtotal_amount,
          o.shipping_amount,
          o.total_amount,
          COALESCE(o.wallet_used_amount, 0) AS wallet_used_amount,
          COALESCE(o.cashback_amount, 0) AS cashback_amount,
          COALESCE(o.cashback_status, 'none') AS cashback_status,
          o.notes,
          o.created_at,
          o.updated_at,

          o.address_id,

          a.full_name AS shipping_full_name,
          a.address_line AS shipping_address_line,
          a.postal_code AS shipping_postal_code,
          a.phone AS shipping_phone,
          a.city AS shipping_city,
          a.state AS shipping_state
        FROM orders o
        LEFT JOIN user_addresses a ON a.id = o.address_id
        WHERE o.user_id = ?
          AND o.order_number = ?
        LIMIT 1
      `)
      .bind(userId, orderNumber)
      .first();

    if (!order) {
      return json({ success: false, error: "order_not_found" }, 404);
    }

    const itemsResult = await context.env.DB
      .prepare(`
        SELECT
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          created_at
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
      `)
      .bind(order.id)
      .all();

    const items = Array.isArray(itemsResult?.results)
      ? itemsResult.results.map((item) => ({
          id: Number(item.id || 0),
          product_id: item.product_id ?? null,
          product_name: item.product_name || "",
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          total_price: Number(item.total_price || 0),
          created_at: item.created_at || null
        }))
      : [];

    return json({
      success: true,
      order: {
        id: Number(order.id || 0),
        order_number: order.order_number || "",
        status: order.status || "pending",
        payment_status: order.payment_status || "pending",
        subtotal_amount: Number(order.subtotal_amount || 0),
        shipping_amount: Number(order.shipping_amount || 0),
        total_amount: Number(order.total_amount || 0),
        wallet_used_amount: Number(order.wallet_used_amount || 0),
        cashback_amount: Number(order.cashback_amount || 0),
        cashback_status: order.cashback_status || "none",
        notes: order.notes || "",
        created_at: order.created_at || null,
        updated_at: order.updated_at || null,
        items,
        shipping_address: order.address_id
          ? {
              full_name: order.shipping_full_name || "",
              address_line: order.shipping_address_line || "",
              postal_code: order.shipping_postal_code || "",
              phone: order.shipping_phone || "",
              city: order.shipping_city || "",
              state: order.shipping_state || ""
            }
          : null
      }
    });
  } catch (error) {
    return json(
      { success: false, error: String(error?.message || error) },
      500
    );
  }
}