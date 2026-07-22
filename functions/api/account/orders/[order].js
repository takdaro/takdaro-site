function getCookie(cookieString, key) {
  if (!cookieString) return null;
  const cookies = cookieString.split("; ");
  const target = cookies.find((item) => item.startsWith(key + "="));
  return target ? target.slice(key.length + 1) : null;
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
      return Response.json(
        { success: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const orderNumber = context.params?.order;

    if (!orderNumber) {
      return Response.json(
        { success: false, error: "order_number is required" },
        { status: 400 }
      );
    }

    const order = await context.env.DB
      .prepare(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.total_amount,
          o.shipping_amount,
          o.discount_amount,
          o.payment_status,
          o.created_at,

          o.shipping_address_id,
          o.billing_address_id,

          sa.full_name AS shipping_full_name,
          sa.address_line AS shipping_address_line,
          sa.postal_code AS shipping_postal_code,
          sa.phone AS shipping_phone,
          sa.city AS shipping_city,
          sa.state AS shipping_state,

          ba.full_name AS billing_full_name,
          ba.address_line AS billing_address_line,
          ba.postal_code AS billing_postal_code,
          ba.phone AS billing_phone,
          ba.city AS billing_city,
          ba.state AS billing_state
        FROM orders o
        LEFT JOIN addresses sa ON sa.id = o.shipping_address_id
        LEFT JOIN addresses ba ON ba.id = o.billing_address_id
        WHERE o.user_id = ? AND o.order_number = ?
        LIMIT 1
      `)
      .bind(userId, orderNumber)
      .first();

    if (!order) {
      return Response.json(
        { success: false, error: "order_not_found" },
        { status: 404 }
      );
    }

    const itemsResult = await context.env.DB
      .prepare(`
        SELECT
          id,
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
      ? itemsResult.results
      : [];

    return Response.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_amount: order.total_amount,
        shipping_amount: order.shipping_amount,
        discount_amount: order.discount_amount,
        payment_status: order.payment_status,
        created_at: order.created_at,
        items,
        shipping_address: order.shipping_address_id ? {
          full_name: order.shipping_full_name,
          address_line: order.shipping_address_line,
          postal_code: order.shipping_postal_code,
          phone: order.shipping_phone,
          city: order.shipping_city,
          state: order.shipping_state
        } : null,
        billing_address: order.billing_address_id ? {
          full_name: order.billing_full_name,
          address_line: order.billing_address_line,
          postal_code: order.billing_postal_code,
          phone: order.billing_phone,
          city: order.billing_city,
          state: order.billing_state
        } : null
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}