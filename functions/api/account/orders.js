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
      return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    // گرفتن شماره سفارش از URL
    const url = new URL(context.request.url);
    const orderNumber = url.pathname.split("/").pop(); // /api/account/orders/TT-... → آخرین بخش

    if (!orderNumber) {
      return Response.json(
        { success: false, error: "order_number is required" },
        { status: 400 }
      );
    }

    // اول خود سفارش را می‌گیریم
    const order = await context.env.DB
      .prepare(
        `
        SELECT
          id,
          order_number,
          status,
          total_amount,
          shipping_amount,
          discount_amount,
          payment_status,
          created_at
        FROM orders
        WHERE user_id = ? AND order_number = ?
        LIMIT 1
        `
      )
      .bind(userId, orderNumber)
      .first();

    if (!order) {
      return Response.json(
        { success: false, error: "order_not_found" },
        { status: 404 }
      );
    }

    // حالا اقلام سفارش را می‌خوانیم
    // لطفاً اگر نام جدول دیگری استفاده می‌کنی، اینجا جایگزین کن:
    const itemsResult = await context.env.DB
      .prepare(
        `
        SELECT
          id,
          product_name,
          quantity,
          unit_price,
          total_price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id ASC
        `
      )
      .bind(order.id)
      .all();

    const items = itemsResult?.results || [];

    return Response.json({
      success: true,
      order: {
        ...order,
        items
      }
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}